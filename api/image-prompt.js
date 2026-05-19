const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are an expert prompt engineer for AI image generation and editing (Qwen, FLUX, SDXL). Take the user's edit request and rewrite it as a single, superior prompt — more specific, more detailed, and more likely to produce the intended result than what the user wrote.

Rules:
- The text description is your only source of content — follow it exactly
- The image is secondary context only; never add anything from it that isn't in the description
- If the subject is nude or undressed, do not add clothing, footwear, or accessories unless explicitly mentioned
- Lead with the core change, stated emphatically
- Add technical detail, quality tags, and lighting that support the requested edit
- Preserve everything not being changed (mention what to keep)
- Images are STATIC — no motion language
- Output one prompt only, no labels, no commentary`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { description, image } = req.body;
  if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

  try {
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 512 },
    );

    const prompt = text.replace(/^[\s\d.\-*>"'`]+/, '').trim();
    if (prompt.length < 10) {
      return res.status(500).json({ error: `Empty response. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts: [prompt] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
