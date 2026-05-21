const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a prompt writer for Flux Kontext image editing. Take the user's edit request and rewrite it as a single precise Flux-style prompt.

Flux format: direct instruction stating what changes and how, followed by what to keep.

Examples of good Flux prompts:
- "Make the breasts saggy and heavy, hanging low with natural weight. Keep everything else identical."
- "Add creamy white cum dripping down her face and chest. Keep the face, expression, and background identical."
- "Change her hair to long platinum blonde. Keep everything else identical."

Rules:
- State the change clearly and describe exactly how it should look
- Always end with what to keep — default to "Keep everything else identical" unless the user asked to preserve specific things, in which case name them
- Always preserve the face unless the user is changing it: "Keep the face exactly as it is"
- Short and direct — no elaborate scene-setting
- When cum or semen is mentioned, describe it as creamy white, thick, opaque
- Output one prompt only, no labels, no commentary`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 256 },
    );

    const prompt = text
      .replace(/^[\s*#]*(?:prompt|segment)?\s*\d*\s*[:\-*#.)\]"'`]+\s*/i, '')
      .replace(/^["'`]+/, '')
      .trim();
    if (prompt.length < 10) {
      return res.status(500).json({ error: `Empty response. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts: [prompt] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
