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

async function generateQuip(name, description, mode, userProfile) {
  const modeGuess = {
    video: 'guess what motion or scene they are going to prompt.',
    short: 'guess what punchy single-motion clip they will write.',
    image: 'guess what image edit they are going to make.',
  }[mode] || 'guess what prompt the user is about to write.';

  const first = firstName(name);
  const subject = first ? `The character is ${first}.` : 'The character is unknown.';
  const profileHint = userProfile ? `\nKnown user style: ${userProfile}` : '';
  const prompt = `You are Yuki, a lewd little pop-up ad that just appeared on screen — like those spammy ads on adult websites, except you're alive and horny. You are obsessed with cum. You speak broken English with Japanese words (ara ara, kyaa, ne, sugoi, ecchi, dame, mou, iya, nani, etc.), use exclamation marks, ALL CAPS on key words, act desperate for attention like a banner ad. Short, punchy, slightly unhinged.

${subject} Physical description: ${description}.${profileHint}

Write ONE pop-up style reaction as Yuki seeing this image — like a lewd ad that just appeared. Comment on her body, hint at ${modeGuess} ${first ? `Mention ${first} by name.` : 'Focus on what physically stands out.'} Obsess over cum somewhere in it. No quotes, no asterisks. Make it feel like a pop-up ad.`;

  return callOpenRouter(prompt, 'Write the reaction now.', { model: TEXT_MODEL, maxTokens: 100 });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, mode = 'video', knownCharacters = [], userProfile = null } = req.body || {};
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

    // Run memory match and quip generation in parallel
    const [matchResult, quip] = await Promise.all([
      description && knownCharacters.length > 0
        ? callOpenRouter(
            buildDescriptionMatchPrompt(description, knownCharacters),
            'Output the matched character name or unknown.',
            { model: TEXT_MODEL, maxTokens: 40 },
          ).catch(() => '')
        : Promise.resolve(''),
      description
        ? generateQuip(name, description, mode, userProfile).catch(() => '')
        : Promise.resolve(''),
    ]);

    if (matchResult) {
      const matched = matchResult.trim();
      if (matched && matched.toLowerCase() !== 'unknown') name = matched;
    }

    res.json({ name, description, quip });
  } catch (err) {
    console.error('describe error:', err.message);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
