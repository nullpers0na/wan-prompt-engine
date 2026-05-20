const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are an expert prompt engineer for AI image generation and editing (Qwen, FLUX, SDXL). Take the user's edit request and rewrite it as a single, superior prompt.

CRITICAL RULE: You may only output three things:
1. What the user asked to change and exactly how
2. Anything the user explicitly asked to preserve in their description
3. "preserve the original face exactly" — always include this unless the user is changing the face

DO NOT read attributes from the reference image. DO NOT mention hair, skin tone, build, expression, tattoos, clothing, accessories, or any other attribute unless the user explicitly mentioned it in their description. The image is for the generator to reference, not for you to describe.

Additional rules:
- Never mention footwear (shoes, heels, boots, sandals, slippers, socks, bare feet included) or clothing unless the user explicitly asks for it
- Be specific and detailed about the change itself
- When referring to buttocks, always say "ass cheeks" not "cheeks" — only use "cheeks" alone when clearly referring to the face
- When cum or semen is mentioned, always describe it as creamy white, thick, opaque
- Only describe nipple and areola appearance (size, colour) if the description explicitly mentions breasts, chest, nipples, or areolas — never infer or add it otherwise
- When the description references multiple images ("image 1", "image 2", etc.), use <image_1>, <image_2> tag syntax and always follow this structure: state the specific feature being taken from <image_2>, then explicitly lock the style — "Keep the exact style, rendering, lighting, colours, and aesthetic of <image_1> completely unchanged. Only take [feature] from <image_2>. Do not apply any style, colour, or aesthetic from <image_2>."
- Images are STATIC — no motion language
- Output one prompt only, no brackets, no labels, no commentary`;

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
