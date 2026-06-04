const fs = require('fs');
const { getDb } = require('./lib/companionDb');
const { generateImage } = require('./lib/comfyClient');
const { promptTemplate } = require('./lib/promptTemplate');

const CHAT_API_URL   = () => (process.env.CHAT_API_URL  || '').replace(/\/$/, '');
const CHAT_API_KEY   = () => process.env.CHAT_API_KEY   || '';
const CHAT_MODEL     = () => process.env.CHAT_MODEL     || 'gpt-3.5-turbo';
const SYSTEM_PROMPT_PATH = () => process.env.SYSTEM_PROMPT_PATH || '';
const REQUEST_TIMEOUT_MS = parseInt(process.env.CHAT_TIMEOUT_MS || '60000', 10);

const IMAGE_MARKER = /\[IMAGE:\s*([\s\S]*?)\]/g;

function loadSystemPrompt() {
  const p = SYSTEM_PROMPT_PATH();
  if (p && fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  return process.env.SYSTEM_PROMPT || 'You are a helpful assistant.';
}

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conversationId, message } = req.body || {};
  if (!conversationId || typeof message !== 'string') {
    return res.status(400).json({ error: 'conversationId and message required' });
  }

  const db = getDb();
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const chatApiUrl = CHAT_API_URL();
  if (!chatApiUrl) return res.status(503).json({ error: 'CHAT_API_URL not configured' });

  // Persist user message
  const now = Date.now();
  db.prepare(`INSERT INTO messages (conversation_id, role, type, content, created_at) VALUES (?,?,?,?,?)`)
    .run(conversationId, 'user', 'text', message, now);
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Build message history from DB
  const history = db.prepare(
    `SELECT role, type, content FROM messages WHERE conversation_id = ? ORDER BY id ASC`
  ).all(conversationId);

  const apiMessages = history
    .filter(m => m.type === 'text')
    .map(m => ({ role: m.role, content: m.content }));

  const systemPrompt = loadSystemPrompt();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let fullText = '';
  let buffer = '';

  try {
    const response = await fetch(`${chatApiUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${CHAT_API_KEY()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL(),
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...apiMessages,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      sendSSE(res, 'error', { message: `API error ${response.status}: ${errText.slice(0, 300)}` });
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (!delta) continue;
          fullText += delta;
          buffer += delta;

          // Strip [IMAGE: ...] markers from visible stream, emit remaining text
          const visible = buffer.replace(IMAGE_MARKER, '');
          if (visible) sendSSE(res, 'token', { text: visible });
          buffer = '';
        } catch (_) { /* skip malformed chunks */ }
      }
    }

    clearTimeout(timer);

    // Parse out all [IMAGE: ...] triggers from full response
    const imageTriggers = [];
    let cleanText = fullText;
    let match;
    IMAGE_MARKER.lastIndex = 0;
    while ((match = IMAGE_MARKER.exec(fullText)) !== null) {
      imageTriggers.push(match[1].trim());
      cleanText = cleanText.replace(match[0], '').trim();
    }

    // Persist assistant text message
    const assistantNow = Date.now();
    db.prepare(`INSERT INTO messages (conversation_id, role, type, content, created_at) VALUES (?,?,?,?,?)`)
      .run(conversationId, 'assistant', 'text', cleanText, assistantNow);
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(assistantNow, conversationId);

    sendSSE(res, 'done', { text: cleanText });

    // Trigger image generation for each [IMAGE: ...] marker
    for (const description of imageTriggers) {
      sendSSE(res, 'image_start', { description });
      try {
        const finalPrompt = promptTemplate(description);
        const { base64, mimeType } = await generateImage(finalPrompt);
        const imgNow = Date.now();
        db.prepare(`INSERT INTO messages (conversation_id, role, type, content, created_at) VALUES (?,?,?,?,?)`)
          .run(conversationId, 'assistant', 'image', JSON.stringify({ base64, mimeType, prompt: finalPrompt }), imgNow);
        db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(imgNow, conversationId);
        sendSSE(res, 'image_done', { base64, mimeType, prompt: finalPrompt });
      } catch (imgErr) {
        sendSSE(res, 'image_error', { description, message: imgErr.message });
      }
    }

  } catch (err) {
    clearTimeout(timer);
    const msg = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Unknown error');
    sendSSE(res, 'error', { message: msg });
  } finally {
    res.end();
  }
};
