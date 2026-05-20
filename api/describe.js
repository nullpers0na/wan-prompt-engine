const { callOpenRouter, VISION_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a visual analyst for AI image generation. Examine the image and identify the character if recognisable — this will be a fictional video game, anime, or 3D rendered character. Output a single concise character description for use as a prompt seed.

Focus on: character name and game/source if identifiable, body type, hair colour/length, skin tone, breast size, body proportions, distinguishing marks, outfit if distinctive.

OUTPUT RULES:
- One line only, no preamble, no commentary
- Comma-separated descriptors, lowercase
- Maximum 25 words
- Lead with character name and game if recognised (e.g. "lara croft, tomb raider")
- Do not mention background, setting, or pose — only the character

Example output:
lara croft, tomb raider, slim athletic build, brown ponytail, medium breasts, tan skin, late 20s`;

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
