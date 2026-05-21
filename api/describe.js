const { callOpenRouter, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const ID_MODEL = 'x-ai/grok-2-vision-1212';

const ID_PROMPT = `You are an expert at identifying fictional characters from video games, anime, and 3D rendered art. Your job is to name the character in this image.

Output ONE line only — the character's name and game/source in lowercase (e.g. "tifa lockhart, final fantasy vii").
If you genuinely have no idea, leave the line blank. But if you have a strong feeling about who it is, say it — a confident best guess is better than silence.

To identify: look at the face, outfit, hair style and colour, body proportions, artstyle, and any distinctive accessories or weapons. Many popular characters are heavily modded or rendered in different styles — focus on facial features and silhouette.`;

const DETAIL_PROMPT = `You are a visual analyst for explicit AI image generation. Look at this image and describe the character's physical attributes.

Output ONE line only — physical description: body type, breast size and shape, ass size and shape, waist-to-hip ratio, skin tone, hair colour/length, piercings, tattoos, facial expression and attitude, overall sexual vibe (e.g. looks like a slut, total bitch energy, bratty princess, cold and arrogant).

Rules: comma-separated, lowercase, max 30 words, no character name, end with the overall vibe read, be blunt and specific.`;

function buildQuipPrompt(name, description, mode) {
  const modeGuess = {
    video: 'guess what motion or scene they are going to prompt — jiggle physics, walking, a body part moving, etc.',
    short: 'guess what punchy single-motion clip they will write.',
    image: 'guess what image edit they are going to make — bigger breasts, saggy tits, nude, cum, outfit change, etc.',
    flux:  'guess what direct Flux edit they will make — bigger breasts, nude, cum, outfit change, etc.',
  }[mode] || 'guess what prompt the user is about to write.';

  const subject = name ? `The character is ${name}.` : 'The character is unknown.';

  return `${subject} Their description: ${description}.

Write ONE cheeky one-liner for someone who just uploaded this image to an AI image/video generator. ${modeGuess}
${name ? `Reference the character by their first name.` : `Comment on what physically stands out and make your guess.`}
Base it only on what's visible in the image — don't invent body parts that aren't shown.
Be witty, direct, a little crude. Output the one-liner only, no quotes, no labels.`;
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

    // Step 1: ID and description in parallel
    const [idResult, descResult] = await Promise.all([
      callOpenRouter(ID_PROMPT, imgContent, { model: ID_MODEL, maxTokens: 60 }).catch(() => ''),
      callOpenRouter(DETAIL_PROMPT, imgContent, { model: VISION_MODEL, maxTokens: 80 }).catch(() => ''),
    ]);

    const name = idResult.replace(/^[\s\-*>]+/, '').trim();
    const description = descResult.replace(/^[\s\-*>]+/, '').trim().split('\n')[0];

    // Step 2: Generate quip with full context (text only, fast)
    const quip = description
      ? await callOpenRouter(buildQuipPrompt(name, description, mode), 'Write the one-liner now.', { model: TEXT_MODEL, maxTokens: 80 }).catch(() => '')
      : '';

    res.json({ name, description, quip: quip.replace(/^["']|["']$/g, '').trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
