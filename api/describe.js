const { callOpenRouter, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

// "elena fisher, uncharted" → "Elena"
function firstName(name) {
  if (!name) return '';
  return name.split(/[,\s]/)[0].replace(/^\w/, c => c.toUpperCase());
}

function buildPrompt(mode) {
  const modeGuess = {
    video: 'guess what motion or scene they are going to prompt — jiggle physics, walking, a body part moving, etc.',
    short: 'guess what punchy single-motion clip they will write.',
    image: 'guess what image edit they are going to make — bigger breasts, saggy tits, nude, cum, outfit change, etc.',
  }[mode] || 'guess what prompt the user is about to write.';

  return `You are an expert at identifying fictional characters AND describing explicit physical attributes for AI image generation.

Output exactly two lines:
LINE 1: character name and game/source in lowercase if you recognise them (e.g. "tifa lockhart, final fantasy vii") — or leave blank if unknown. Check face, outfit, hair, body shape, artstyle, accessories. Characters may be rendered in different styles — use your best judgement.
LINE 2: physical description — only describe what is actually visible in this image. Include: body type, skin tone, hair colour/length, facial expression, overall sexual vibe (e.g. looks like a slut, total bitch energy, bratty princess). Add breast size/shape, ass size/shape, waist-to-hip ratio, piercings, tattoos ONLY if they are clearly visible. Comma-separated, lowercase, max 30 words, no character name.

Two lines only. No labels, no preamble.`;
}

function buildDescriptionMatchPrompt(newDescription, knownCharacters) {
  const list = knownCharacters.map(c => `- ${c.name}: ${c.description}`).join('\n');
  return `You are a character matching assistant. Compare this physical description against a list of known characters and find the best match.\n\nNew description: ${newDescription}\n\nKnown characters:\n${list}\n\nFocus on consistent attributes: body type, breast size, ass size, skin tone, hair colour/length. Ignore minor differences from lighting, angle, or rendering style.\nOutput ONLY the exact character name from the list above if it matches with reasonable confidence, or the single word: unknown`;
}

async function generateQuip(name, description, mode, topPreferences) {
  const modeGuess = {
    video: 'guess what motion or scene they are going to prompt.',
    short: 'guess what punchy single-motion clip they will write.',
    image: 'guess what image edit they are going to make.',
  }[mode] || 'guess what prompt the user is about to write.';

  const first = firstName(name);
  const subject = first ? `The character is ${first}.` : 'The character is unknown.';
  const prefHint = topPreferences.length
    ? `This user's most requested content: ${topPreferences.join(', ')}.`
    : '';
  const prompt = `${subject} Physical description: ${description}. ${prefHint}\n\nWrite ONE filthy, explicit one-liner for someone who just uploaded this image to an AI generator — ${modeGuess} ${first ? `Call her ${first}.` : 'Comment on what physically stands out.'} Reference their usual interests if relevant. Be raunchy, lewd, specific. One sentence, no quotes, no asterisks.`;

  return callOpenRouter(prompt, 'Write the one-liner now.', { model: TEXT_MODEL, maxTokens: 80 });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, mode = 'video', knownCharacters = [], preferences = {} } = req.body || {};
    const topPreferences = Object.entries(preferences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k]) => k);
    if (!image?.data || !image?.mediaType) return res.status(400).json({ error: 'Image is required' });

    const imgContent = [
      { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
      { type: 'text', text: 'Identify and describe the character in this image.' },
    ];

    const text = await callOpenRouter(buildPrompt(mode), imgContent, { model: VISION_MODEL, maxTokens: 160 });

    const lines = text.split('\n').map(l => l.replace(/^[\s\-*>]+/, '').trim()).filter(Boolean);
    let name        = lines[0] || '';
    let description = lines[1] || '';

    // Treat non-name responses as blank
    if (/^(unknown|unidentified|unnamed|unrecognized|unrecognised|n\/a|none|-)$/i.test(name)) name = '';

    // Always check memory bank first — user-saved names take priority over vision model names
    if (description && knownCharacters.length > 0) {
      const matchResult = await callOpenRouter(
        buildDescriptionMatchPrompt(description, knownCharacters),
        'Output the matched character name or unknown.',
        { model: TEXT_MODEL, maxTokens: 40 },
      ).catch(() => '');
      const matched = matchResult.trim();
      if (matched && matched.toLowerCase() !== 'unknown') name = matched;
    }

    // Always generate quip separately — vision model drops it when overloaded
    const quip = description
      ? await generateQuip(name, description, mode, topPreferences).catch(() => '')
      : '';

    res.json({ name, description, quip });
  } catch (err) {
    console.error('describe error:', err.message);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
