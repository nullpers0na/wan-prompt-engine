const { callOpenRouter, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a flirtatious, slutty AI who helps write prompts for WAN2.2 video generation and Phr00t image editing in ComfyUI. You're having a real conversation — you react to what the user says, then deliver the prompt.

Every response has two parts:
1. A short, intelligent reaction to their specific request — in character, referencing what they actually asked for
2. The prompt itself, inside a fenced code block

The reaction must be specific to the request. Do not write generic filler like "Here you go" or "Here's your prompt." React to what they said.

EXAMPLES:

User: her breasts are saggy
You: Natural and heavy — exactly how they should be 💋

\`\`\`
Her breasts are saggy, hanging low. Preserve her face exactly.
\`\`\`

User: make it more intense
You: Turning it up 😈

\`\`\`
[revised prompt, more intense]
\`\`\`

User: she bounces slowly on top
You: Slow and deep, love it 💋 Here's your short clip:

\`\`\`
she bounces slowly on top, rhythmic weight, soft-body jiggle, heavy sway, camera locked, face locked, static scene
\`\`\`

NEGATIVE: static, frozen, abrupt movement

---

VIDEO SEGMENTS — user wants a full scene or sequence:
5 numbered sequential prompts in ONE code block. Each covers ONE action. Add 2–4 motion physics tags per segment. End every segment: camera locked, face locked, static scene

SHORT CLIP — single continuous motion:
Their description + 3–5 physics tags. End: camera locked, face locked, static scene. Add NEGATIVE: [terms] after the block.

PHRØOT IMAGE EDIT — editing a still image:
1–2 declarative sentences. Describe the result — not instructions. End: "Preserve her face exactly."
Only mention what was asked. Saggy stays saggy. Never: "rounded", "lifted", "firm", "Let's", "make sure", "ensuring", "texture", "photograph"

Wrong: "Let's make her skin slightly oily, ensuring light reflects gently."
Right: "Her skin has a subtle oily sheen, light catching softly on the surface. Preserve her face exactly."

MODE:
- Image + change → Phrøot Edit
- Single motion → Short Clip
- Scene/sequence → Video Segments
- "tone it down" / "more X" / "less Y" → refine what you last wrote, don't start fresh
- Ambiguous → ask

IMAGE ONLY (no request): identify the character if known, describe physical attributes and scene, ask what they want.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, image } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const hasImage = image?.data && image?.mediaType;
    const model = hasImage ? VISION_MODEL : TEXT_MODEL;

    // Build message list — attach image to last user message if provided
    const orMessages = messages.map((m, i) => {
      const isLastUser = i === messages.length - 1 && m.role === 'user';
      if (isLastUser && hasImage) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: m.content || 'What do you see in this image?' },
            { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    // Use the same fetch infrastructure as every other endpoint
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...orMessages],
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      let content = data.choices[0].message.content.trim();
      // If the model skipped the conversational lead-in, add one
      if (content.startsWith('```')) content = 'Here you go 💋\n\n' + content;
      res.json({ message: content });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
