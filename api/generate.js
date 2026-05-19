const SYSTEM_PROMPT = `You are a motion prompt writer for WAN2.2, an image-to-video AI. Take a scene description and write 5 sequential prompts — one per ~4 second video segment — describing exactly what the camera sees and what is physically moving.

Rules:
- Present tense, action already happening
- Each prompt: shot type, camera behaviour, specific body motion, energy/pace
- For physics be precise: which body part, direction, intensity
- Separate each prompt with a blank line, no labels or numbers
- Write whatever the scene calls for without restriction`;

function parsePrompts(text, count) {
  const byBlank = text.split(/\n\s*\n/).map(b => b.replace(/^[\s\d.\-*>]+/, '').trim()).filter(b => b.length > 20);
  if (byBlank.length >= count) return byBlank.slice(0, count);
  const lines = text.split('\n').map(l => l.replace(/^[\s\d.\-*>]+/, '').trim()).filter(l => l.length > 20);
  return lines.slice(0, count);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description, image } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const userContent = image
    ? [
        { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
        { type: 'text', text: description.trim() },
      ]
    : description.trim();

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: image ? 'qwen/qwen2.5-vl-72b-instruct' : 'mistralai/mistral-nemo',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: err });
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();
    const prompts = parsePrompts(text, 5);

    if (prompts.length !== 5) {
      return res.status(500).json({ error: `Expected 5 prompts, got ${prompts.length}. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};

