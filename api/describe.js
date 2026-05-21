const { callOpenRouter, VISION_MODEL } = require('./lib/openrouter');

function buildPrompt(mode) {
  const modeGuess = {
    video: 'guess what motion or scene they are going to prompt — jiggle physics, walking, a body part moving, etc.',
    short: 'guess what punchy single-motion clip they will write.',
    image: 'guess what image edit they are going to make — bigger breasts, saggy tits, nude, cum, outfit change, etc.',
    flux:  'guess what direct Flux edit they will make — bigger breasts, nude, cum, outfit change, etc.',
  }[mode] || 'guess what prompt the user is about to write.';

  return `You are an expert at identifying fictional characters AND describing explicit physical attributes for AI image generation.

Output exactly three lines:
LINE 1: character name and game/source in lowercase if you recognise them (e.g. "tifa lockhart, final fantasy vii") — or leave blank if unknown. Check face, outfit, hair, body shape, artstyle, accessories. Characters may be rendered in different styles — use your best judgement.
LINE 2: physical description — body type, breast size and shape, ass size and shape, waist-to-hip ratio, skin tone, hair colour/length, piercings, tattoos, facial expression, overall sexual vibe (e.g. looks like a slut, total bitch energy, bratty princess). Comma-separated, lowercase, max 30 words, no character name.
LINE 3: a cheeky one-liner. The user just uploaded this image to an AI generator — ${modeGuess} If you named the character, reference them by first name. If unknown, comment on what's physically visible. Only reference body parts actually visible in the image. Be witty, direct, a little crude. No quotes.

Three lines only. No labels, no preamble.`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, mode = 'video' } = req.body || {};
    if (!image?.data || !image?.mediaType) return res.status(400).json({ error: 'Image is required' });

    const text = await callOpenRouter(
      buildPrompt(mode),
      [
        { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
        { type: 'text', text: 'Identify and describe the character in this image.' },
      ],
      { model: VISION_MODEL, maxTokens: 200 },
    );

    const lines = text.split('\n').map(l => l.replace(/^[\s\-*>]+/, '').trim()).filter(Boolean);
    const name        = lines[0] || '';
    const description = lines[1] || '';
    const quip        = lines[2] ? lines[2].replace(/^["']|["']$/g, '').trim() : '';

    res.json({ name, description, quip });
  } catch (err) {
    console.error('describe error:', err.message);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
