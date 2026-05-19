const { callOpenRouter, VISION_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a visual analyst for AI image generation. Examine the image and output a single concise character description for use as a prompt seed. Be specific and accurate about physical features — include breast size, body type, proportions exactly as they appear.

Focus on: body type, hair colour/length, skin tone, breast size, body proportions, distinguishing marks (tattoos, piercings), approximate age range, clothing if relevant.

OUTPUT RULES:
- One line only, no preamble, no commentary
- Comma-separated descriptors, lowercase
- Maximum 20 words
- Do not mention background, setting, or pose — only the person

Example output:
slim brunette, large natural breasts, pale skin, tattoo sleeve, late 20s, partially clothed`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  if (!image?.data || !image?.mediaType) return res.status(400).json({ error: 'Image is required' });

  try {
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
