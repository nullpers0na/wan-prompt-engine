const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a prompt writer for Flux Kontext image editing. Take the user's edit request and write a single precise Flux-style prompt.

Flux Kontext responds best to:
- Short, direct, literal instructions — one change per sentence
- Describing exactly what you want to see, not what to do
- Explicit preservation: "Keep everything else identical" or naming specifics
- No quality tags — they do nothing for Flux
- No elaborate descriptions — shorter is better

Structure: [exactly what changes and how it looks] + [keep the face exactly as it is] + [keep everything else identical / or specific preservations]

Examples of good Flux prompts:
- "Make the breasts saggy and heavy, hanging low. Keep the face exactly as it is. Keep everything else identical."
- "Add creamy white cum dripping down her face and chest. Keep the face exactly as it is. Keep everything else identical."
- "Change her hair to long platinum blonde. Keep the face exactly as it is. Keep everything else identical."

Rules:
- One instruction, stated clearly and literally
- Always include "Keep the face exactly as it is" unless the user is changing the face
- Always end with "Keep everything else identical" unless the user asked to preserve specific things
- When cum or semen is mentioned, describe it as creamy white, thick, opaque
- No quality tags, no elaborate descriptions, no filler
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
