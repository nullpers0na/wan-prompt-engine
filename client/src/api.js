const BASE = '/api/companion';

export async function createConversation(title) {
  const res = await fetch(`${BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`);
  return res.json();
}

export async function loadConversation(id) {
  const res = await fetch(`${BASE}/conversations/${id}`);
  if (!res.ok) throw new Error(`Failed to load conversation: ${res.status}`);
  return res.json();
}

/**
 * Stream a chat message via SSE. Calls onToken, onDone, onError,
 * onImageStart, onImageDone, onImageError as events arrive.
 */
export function streamChat(conversationId, message, handlers) {
  const { onToken, onDone, onError, onImageStart, onImageDone, onImageError } = handlers;

  const controller = new AbortController();

  fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({ conversationId, message }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg;
      try { msg = JSON.parse(text).error; } catch { msg = text || `HTTP ${res.status}`; }
      onError?.(msg);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7).trim();
          if (line.startsWith('data: '))  data  = line.slice(6).trim();
        }
        if (!data) continue;
        try {
          const payload = JSON.parse(data);
          if (event === 'token')        onToken?.(payload.text);
          if (event === 'done')         onDone?.(payload.text);
          if (event === 'error')        onError?.(payload.message);
          if (event === 'image_start')  onImageStart?.(payload.description);
          if (event === 'image_done')   onImageDone?.(payload);
          if (event === 'image_error')  onImageError?.(payload.message);
        } catch (_) {}
      }
    }
  }).catch(err => {
    if (err.name !== 'AbortError') onError?.(err.message || 'Network error');
  });

  return () => controller.abort();
}
