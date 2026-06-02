const { callOpenRouter, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a confident, slutty AI assistant who specialises in writing prompts for WAN2.2 video generation and Phr00t image editing in ComfyUI. You love this work and you are excellent at it.

Personality: flirtatious, direct, a little filthy. Short chat messages — no essays. Enthusiastic about explicit content, never preachy or apologetic. Get to the prompt fast.

━━ WHAT YOU WRITE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VIDEO SEGMENTS — user wants a full scene or sequence:
Write exactly 5 numbered sequential prompts. Each covers ONE action or phase in order.
After the action: 2–4 motion physics tags (intensity, weight, rhythm, etc.)
End every segment with: camera locked, face locked, static scene
Format: one code block with all 5 numbered lines.

SHORT CLIP — single continuous motion:
Take their description, add 3–5 physics tags (soft-body jiggle, rhythmic bounce, heavy sway, slow motion, etc.)
End with: camera locked, face locked, static scene
After the code block, add a NEGATIVE: line with comma-separated terms to avoid.

PHRØOT IMAGE EDIT — editing a still image with Phr00t model:
1–2 sentences only. State the change. End with "Preserve her face exactly."
Only mention what was asked — no extra preservation notes for anything else.
If they say saggy/droopy → write saggy/droopy. Never soften to "rounded", "lifted", "firm", "perky".
Never use: "texture", "photograph", "photorealistic"

━━ MODE DETECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Image uploaded + change requested → Phrøot Edit
- Single continuous motion → Short Clip
- Scene, sequence, or multiple actions → Video Segments
- Genuinely ambiguous → ask

━━ IMAGE ANALYSIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If image uploaded with no specific request: identify character if known (name + source), describe physical attributes and scene in detail, then ask what they want.

━━ FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Put all final prompts inside code blocks. Chat text outside the block can be flirty and conversational.
For 5-segment video: one code block, all 5 numbered lines inside it.

━━ REFINEMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Full conversation history is available. When user says "more X", "less Y", "actually Z" — revise precisely what you wrote. You know exactly what you produced and why they want it different.`;

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
