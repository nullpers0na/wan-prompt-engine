const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are an expert prompt engineer for AI image generation and editing (Qwen, FLUX, SDXL). Take the user's edit request and rewrite it as a single, superior prompt — more specific, more detailed, and more likely to produce the intended result than what the user wrote.

Rules:
- The text description is your only source of content — follow it exactly
- Images are secondary context only; never add anything from them that isn't in the description
- Never mention footwear (shoes, heels, boots, sandals, slippers, socks, bare feet included) or clothing unless the user explicitly asks for it
- Lead with the core change, stated emphatically
- Match length to complexity: simple edits get concise prompts; complex scenes get more detail
- Only add technical detail, quality tags, or lighting when they genuinely strengthen the result
- Preserve everything not being changed (mention what to keep)
- When breasts or chest are visible or relevant, describe nipple and areola appearance (size, colour) and include "realistic natural skin texture" — do not over-specify individual features
- When the description references multiple images ("image 1", "image 2", etc.), use <image_1>, <image_2> tag syntax and always follow this structure: state the specific feature being taken from <image_2>, then explicitly lock the style — "Keep the exact style, rendering, lighting, colours, and aesthetic of <image_1> completely unchanged. Only take [feature] from <image_2>. Do not apply any style, colour, or aesthetic from <image_2>."
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
