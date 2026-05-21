const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are an expert prompt engineer for Qwen image editing. Take the user's edit request and write a single precise prompt that will produce the intended result.

Structure: [what to change and exactly how] + [preserve the original face exactly] + [anything the user explicitly asked to preserve]

Rules:
- Describe the change in detail — be specific about exactly how it should look
- Only mention attributes the user explicitly described — do not pull hair, skin, build, clothing, tattoos, or any other attributes from the reference image
- Always end with "preserve the original face exactly" unless the user is changing the face
- When the description references multiple images, use <image_1> <image_2> syntax: state what to take from <image_2>, then "Keep the exact style, rendering, lighting and aesthetic of <image_1> unchanged"
- When cum or semen is mentioned, describe it as creamy white, thick, opaque
- Images are STATIC — no motion language
- Output one prompt only, no labels, no commentary`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 512 },
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
