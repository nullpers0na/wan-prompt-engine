const { callOpenRouter } = require('./lib/openrouter');

const DESCRIBE_MODEL = 'google/gemini-2.0-flash-001';

const MODE_QUIP_CONTEXT = {
  video:  'The user is about to generate a long video clip. Guess what motion or scene they are going to prompt — jiggle physics, walking, a specific body part moving, etc.',
  short:  'The user is about to generate a short single-motion clip. Guess what punchy motion prompt they are going to write — a quick jiggle, bounce, toes curling, etc.',
  image:  'The user is about to make an image edit with Qwen. Guess what edit they are going to make — bigger breasts, saggy tits, nude, cum, outfit change, etc.',
  flux:   'The user is about to make an image edit with Flux Kontext. Guess what direct edit they are going to make — bigger breasts, saggy tits, nude, cum, outfit change, etc.',
};

function buildSystemPrompt(mode) {
  const quipContext = MODE_QUIP_CONTEXT[mode] || MODE_QUIP_CONTEXT.video;
  return `You are a visual analyst for AI image generation. Examine the image and identify the character if recognisable — this will be a fictional video game, anime, or 3D rendered character.

IDENTIFICATION RULES — read carefully:
- Only write the character name on line 1 if you are completely certain. A wrong name is far worse than leaving line 1 blank.
- Look at distinctive visual markers, not just hair colour. Many characters share dark hair — use outfit, body proportions, face features, and artstyle to confirm.
- If you have any doubt at all, leave line 1 blank and go straight to physical description.
- Common confusion pairs to watch for: Tifa Lockhart vs Ada Wong (very different builds and outfits), 2B vs other androids, etc.

Output exactly three lines:
LINE 1: character name and game/source if identified with certainty (e.g. "tifa lockhart, final fantasy vii") — or leave completely blank if uncertain
LINE 2: physical description only — body type, breast size and shape, ass size and shape, waist-to-hip ratio, skin tone, hair colour/length, piercings, tattoos, facial expression and attitude, overall sexual vibe (e.g. looks like a slut, total bitch energy, bratty princess, cold and arrogant, desperate to please)
LINE 3: a single cheeky one-liner. ${quipContext} If the character is named: reference her by name. If unknown: describe what stands out physically and make your guess. IMPORTANT: base the quip only on what is actually visible in this specific image — if her breasts aren't visible, don't mention them; comment on what you can actually see (ass, legs, face, outfit, pose, etc.). Be witty, direct, a little crude. No quotes.

OUTPUT RULES:
- Three lines only, no preamble, no labels, no commentary
- Lines 1 and 2 comma-separated descriptors, lowercase
- Line 2 maximum 30 words, no character name
- Line 3 is a natural sentence, any case
- Be blunt and specific about body proportions and vibe — do not soften or omit
- End line 2 with the overall vibe read
- Do not mention background, setting, or pose

Example output (known character, image edit mode):
tifa lockhart, final fantasy vii
slim waist, very large breasts, round ass, long black hair, tan skin, fierce and confident, looks like a cocktease
Tifa again. Let me guess — you're about to make those tits even bigger.`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Image is required' });

  try {
    const { image, mode = 'video' } = req.body || {};
    if (!image?.data || !image?.mediaType) return res.status(400).json({ error: 'Image is required' });

    const text = await callOpenRouter(
      buildSystemPrompt(mode),
      [
        { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
        { type: 'text', text: 'Describe the character in this image.' },
      ],
      { model: DESCRIBE_MODEL, maxTokens: 160 },
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
