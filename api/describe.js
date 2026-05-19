const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are a visual analyst for AI image generation. Examine the image and output a single concise character description suitable for use as a prompt seed.

Focus only on: body type, hair colour/length, skin tone, notable physical features (breast size, body proportions, distinguishing marks like tattoos or piercings), approximate age range, and any clothing if relevant.

OUTPUT RULES:
- One line only, no preamble, no commentary
- Comma-separated descriptors, lowercase
- Maximum 20 words
- Do not mention the background, setting, or pose — only the person

Example output:
slim brunette, large natural breasts, pale skin, tattoo sleeve, late 20s, partially clothed`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;
  if (!image || !image.data || !image.mediaType) {
    return res.status(400).json({ error: 'Image is required' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 128,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
            { type: 'text', text: 'Describe the character in this image.' },
          ],
        },
      ],
    });

    const description = message.content[0].text.trim().replace(/^[\s\-*>]+/, '');
    res.json({ description });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
