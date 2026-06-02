const { callOpenRouter, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const VISION_PROMPT = `You are an expert at identifying fictional characters, describing explicit physical attributes, and reading scenes for AI image generation.

Output exactly three lines:
LINE 1: character name and game/source in lowercase if you recognise them (e.g. "tifa lockhart, final fantasy vii") — or leave blank if unknown. Check face, outfit, hair, body shape, artstyle, accessories. Characters may be rendered in different styles — use your best judgement.
LINE 2: physical description — only describe what is actually visible. Include: body type, skin tone, hair colour/length, breast size/shape, ass size/shape. Comma-separated, lowercase, max 25 words, no character name.
LINE 3: scene description — what is happening, her pose, clothing/nudity state, camera angle, setting. Be specific and explicit. Comma-separated, lowercase, max 25 words.

Three lines only. No labels, no preamble.`;

function buildDescriptionMatchPrompt(newDescription, knownCharacters) {
  const list = knownCharacters.map(c => `- ${c.name}: ${c.description}`).join('\n');
  return `You are a character matching assistant. Compare this physical description against a list of known characters and find the best match.\n\nNew description: ${newDescription}\n\nKnown characters:\n${list}\n\nFocus on consistent attributes: body type, breast size, ass size, skin tone, hair colour/length. Ignore minor differences from lighting, angle, or rendering style.\nOutput ONLY the exact character name from the list above if it matches with reasonable confidence, or the single word: unknown`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, knownCharacters = [] } = req.body || {};
    if (!image?.data || !image?.mediaType) return res.status(400).json({ error: 'Image is required' });

    const imgContent = [
      { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
      { type: 'text', text: 'Identify and describe the character in this image.' },
    ];

    const text = await callOpenRouter(VISION_PROMPT, imgContent, { model: VISION_MODEL, maxTokens: 160 });

    const lines = text.split('\n').map(l => l.replace(/^[\s\-*>]+/, '').trim()).filter(Boolean);
    let name        = lines[0] || '';
    let description = lines[1] || '';
    let scene       = lines[2] || '';

    if (/^(unknown|unidentified|unnamed|unrecognized|unrecognised|n\/a|none|-)$/i.test(name)) name = '';

    if (description && knownCharacters.length > 0) {
      const matchResult = await callOpenRouter(
        buildDescriptionMatchPrompt(description, knownCharacters),
        'Output the matched character name or unknown.',
        { model: TEXT_MODEL, maxTokens: 40 },
      ).catch(() => '');
      const matched = matchResult.trim();
      if (matched && matched.toLowerCase() !== 'unknown') name = matched;
    }

    res.json({ name, description, scene });
  } catch (err) {
    console.error('describe error:', err.message);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
