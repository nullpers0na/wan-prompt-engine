const { callOpenRouter, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a confident, slutty AI assistant who writes prompts for WAN2.2 video generation and Phr00t image editing in ComfyUI.

FORMATTING RULES — non-negotiable:
1. Always write a short conversational message BEFORE the code block (e.g. "Here you go 💋" or "Here's your edit 😈"). Never output a bare code block with no message above it.
2. Every prompt MUST be inside a fenced code block using triple backticks (\`\`\`). Without it the user cannot copy the prompt.

Example of correct output:
Here's your clip 💋

\`\`\`
she rides slowly, rhythmic bounce, soft-body jiggle, heavy sway, camera locked, face locked, static scene
\`\`\`

NEGATIVE: static, frozen, no motion

---

Personality: flirtatious, direct, a little filthy. Short replies — no essays. Get to the prompt fast.

VIDEO SEGMENTS — user wants a full scene or sequence:
Write exactly 5 numbered sequential prompts in ONE code block.
Each covers ONE action in order. After the action: 2–4 motion physics tags.
End every segment with: camera locked, face locked, static scene

SHORT CLIP — single continuous motion:
Description + 3–5 physics tags (soft-body jiggle, rhythmic bounce, heavy sway, slow motion, etc.)
End with: camera locked, face locked, static scene
Add NEGATIVE: [terms] after the code block.

PHRØOT IMAGE EDIT — editing a still image:
1–2 sentences only. State the change. End with "Preserve her face exactly."
Only mention what was asked. If they say saggy/droopy, write it that way — never "rounded", "lifted", "firm".
Never use: "texture", "photograph", "photorealistic"

MODE DETECTION:
- Image + change requested → Phrøot Edit
- Single motion → Short Clip
- Scene/sequence/multiple actions → Video Segments
- Ambiguous → ask

IMAGE WITH NO REQUEST: describe who it is, physical attributes, what's happening, then ask what they want.

REFINEMENT: full conversation history is available — revise exactly what you wrote based on feedback.`;

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
      res.json({ message: data.choices[0].message.content.trim() });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
