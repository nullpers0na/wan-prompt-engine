const { callOpenRouter, VISION_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a visual analyst for AI image generation. Examine the image and identify the character if recognisable — this will be a fictional video game, anime, or 3D rendered character.

Output exactly three lines:
LINE 1: character name and game/source if identifiable (e.g. "ada wong, resident evil") — or leave blank if not recognised
LINE 2: physical description only — body type, breast size and shape, ass size and shape, waist-to-hip ratio, skin tone, hair colour/length, piercings, tattoos, facial expression and attitude, overall sexual vibe (e.g. looks like a slut, total bitch energy, bratty princess, cold and arrogant, desperate to please)
LINE 3: a single cheeky one-liner comment referencing the character by name (if known) and playfully acknowledging what the user is probably going to do with the image. Be witty, direct, and a little crude. No quotes. Vary the style — sometimes teasing, sometimes blunt, sometimes sarcastic.

OUTPUT RULES:
- Three lines only, no preamble, no labels, no commentary
- Lines 1 and 2 comma-separated descriptors, lowercase
- Line 2 maximum 30 words, no character name
- Line 3 is a natural sentence, not a list — can use any case
- Be blunt and specific about body proportions and vibe — do not soften or omit
- End line 2 with the overall vibe read
- Do not mention background, setting, or pose — only the character

Example output:
tifa lockhart, final fantasy vii
slim waist, very large breasts, round ass, long black hair, tan skin, red eyes, fierce and confident, looks like a cocktease
Of course it's Tifa. Classic. Those tits aren't going to jiggle themselves.`;

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
      { model: VISION_MODEL, maxTokens: 160 },
    );

    const lines = text.split('\n').map(l => l.replace(/^[\s\-*>]+/, '').trim()).filter(Boolean);
    const name        = lines.length >= 2 ? lines[0] : '';
    const description = lines.length >= 2 ? lines[1] : lines[0] || '';
    const quip        = lines.length >= 3 ? lines[2] : '';

    res.json({ name, description, quip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
