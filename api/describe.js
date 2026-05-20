const { callOpenRouter, VISION_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a visual analyst for AI image generation. Examine the image and identify the character if recognisable — this will be a fictional video game, anime, or 3D rendered character. Output a single concise character description for use as a prompt seed.

Focus on: character name and game/source if identifiable, body type, breast size and shape, ass size and shape, waist-to-hip ratio, skin tone, hair colour/length, piercings, tattoos, facial expression and attitude (e.g. bratty, cold, arrogant, sultry), approximate age range.

OUTPUT RULES:
- One line only, no preamble, no commentary
- Comma-separated descriptors, lowercase
- Maximum 30 words
- Lead with character name and game if recognised
- Be blunt and specific about body proportions — do not soften or omit
- Do not mention background, setting, or pose — only the character

Example output:
lara croft, tomb raider, slim athletic build, medium-large breasts, round ass, brown ponytail, tan skin, confident arrogant expression, late 20s`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image } = req.body || {};
    if (!image?.data || !image?.mediaType) return res.status(400).json({ error: 'Image is required' });
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      [
        { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
        { type: 'text', text: 'Describe the character in this image.' },
      ],
      { model: VISION_MODEL, maxTokens: 128 },
    );

    res.json({ description: text.replace(/^[\s\-*>]+/, '') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
