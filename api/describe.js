const { callOpenRouter, VISION_MODEL } = require('./lib/openrouter');

const ID_MODEL     = 'google/gemini-2.0-flash-exp'; // strong at character recognition
const DETAIL_MODEL = VISION_MODEL;                   // strong at explicit physical description

const ID_PROMPT = `You are a character identification expert. Look at this image and identify the character if they are from a video game, anime, or 3D rendered source.

Output ONE line only:
- If you recognise the character with certainty: their name and game/source in lowercase (e.g. "tifa lockhart, final fantasy vii")
- If you are not certain: leave the line completely blank

Do not guess. A wrong name is far worse than a blank. Look at outfit, body proportions, artstyle, and face — not just hair colour.`;

function buildDetailPrompt(mode) {
  const modeGuess = {
    video: 'The user is about to generate a video clip — guess what motion or scene they are going to prompt (jiggle physics, walking, a body part moving, etc.).',
    short: 'The user is about to generate a short single-motion clip — guess what punchy motion prompt they will write.',
    image: 'The user is about to make an image edit with Qwen — guess what edit they are going to make (bigger breasts, saggy tits, nude, cum, outfit change, etc.).',
    flux:  'The user is about to make a Flux Kontext image edit — guess what direct edit they will make.',
  }[mode] || 'Guess what prompt the user is about to write.';

  return `You are a visual analyst for explicit AI image generation. Look at this image and describe the character's physical attributes in detail.

Output exactly TWO lines:
LINE 1: physical description — body type, breast size and shape, ass size and shape, waist-to-hip ratio, skin tone, hair colour/length, piercings, tattoos, facial expression and attitude, overall sexual vibe (e.g. looks like a slut, total bitch energy, bratty princess, cold and arrogant)
LINE 2: a single cheeky one-liner. ${modeGuess} Base it only on what is actually visible in this image — if breasts aren't in frame, don't mention them; comment on what you can actually see. Be witty, direct, a little crude. No quotes.

OUTPUT RULES:
- Two lines only, no preamble, no labels
- Line 1 comma-separated, lowercase, max 30 words, no character name
- Line 2 is a natural sentence, any case
- Be blunt and specific — do not soften or omit
- End line 1 with the overall vibe read`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, mode = 'video' } = req.body || {};
    if (!image?.data || !image?.mediaType) return res.status(400).json({ error: 'Image is required' });

    const imgContent = [
      { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
      { type: 'text', text: 'Describe the character in this image.' },
    ];

    const [idResult, detailResult] = await Promise.all([
      callOpenRouter(ID_PROMPT, imgContent, { model: ID_MODEL, maxTokens: 40 }).catch(() => ''),
      callOpenRouter(buildDetailPrompt(mode), imgContent, { model: DETAIL_MODEL, maxTokens: 160 }).catch(() => ''),
    ]);

    const name = idResult.replace(/^[\s\-*>]+/, '').trim();

    const detailLines = detailResult.split('\n').map(l => l.replace(/^[\s\-*>]+/, '').trim()).filter(Boolean);
    const description = detailLines[0] || '';
    let quip = detailLines[1] || '';

    // If we got a name and the quip doesn't already reference it, prepend it naturally
    if (name && quip && !quip.toLowerCase().includes(name.split(',')[0].toLowerCase())) {
      quip = quip.replace(/^(she|her)\b/i, name.split(',')[0]);
    }

    res.json({ name, description, quip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
