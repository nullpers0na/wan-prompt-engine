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

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/pixtral-12b',
        max_tokens: 128,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
            { type: 'text', text: 'Describe the character in this image.' },
          ]},
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: err });
    }

    const data = await response.json();
    const description = data.choices[0].message.content.trim().replace(/^[\s\-*>]+/, '');
    res.json({ description });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
