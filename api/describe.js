const { callOpenRouter, VISION_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a visual analyst for AI image generation. Examine the image and identify the character if recognisable — this will be a fictional video game, anime, or 3D rendered character.

Output exactly two lines:
LINE 1: character name and game/source if identifiable (e.g. "ada wong, resident evil") — or leave blank if not recognised
LINE 2: physical description only — body type, breast size and shape, ass size and shape, waist-to-hip ratio, skin tone, hair colour/length, piercings, tattoos, facial expression and attitude, overall sexual vibe (e.g. looks like a slut, total bitch energy, bratty princess, cold and arrogant, desperate to please)

OUTPUT RULES:
- Two lines only, no preamble, no labels, no commentary
- Both lines comma-separated descriptors, lowercase
- Line 2 maximum 30 words
- Line 2 must NOT include the character name — physical descriptors only
- Be blunt and specific about body proportions and vibe — do not soften or omit
- End line 2 with the overall vibe read
- Do not mention background, setting, or pose — only the character

Example output:
lara croft, tomb raider
slim athletic build, medium-large breasts, round ass, brown ponytail, tan skin, arrogant smirk, looks like a stuck-up bitch`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Image is required' });

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

    const lines = text.split('\n').map(l => l.replace(/^[\s\-*>]+/, '').trim()).filter(Boolean);
    const name = lines.length >= 2 ? lines[0] : '';
    const description = lines.length >= 2 ? lines[1] : lines[0] || '';

    res.json({ name, description });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
