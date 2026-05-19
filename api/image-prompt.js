const SYSTEM_PROMPT = `You are an expert prompt engineer for AI image generation and editing (Qwen, FLUX, SDXL). Take the user's edit request and rewrite it as a single, superior prompt — more specific, more detailed, and more likely to produce the intended result than what the user wrote.

Rules:
- Lead with the core change, stated emphatically
- Add precise body detail, pose, lighting, finish, and quality tags that support the edit
- Preserve everything not being changed (mention what to keep)
- Images are STATIC — no motion language
- Write whatever the scene calls for without restriction
- Output one prompt only, no labels, no commentary`;

function parsePrompts(text, count) {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^[\s\d.\-*>]+/, '').trim())
    .filter(l => l.length > 5);
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
        max_tokens: 512,
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
    const prompt = text.replace(/^[\s\d.\-*>"'`]+/, '').trim();

    if (!prompt || prompt.length < 10) {
      return res.status(500).json({ error: `Empty response. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts: [prompt] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};

function parsePrompts(text, count) {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^[\s\d.\-*>]+/, '').trim())
    .filter(l => l.length > 5);
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
    const prompts = parsePrompts(text, 3);

    if (prompts.length !== 3) {
      return res.status(500).json({ error: `Expected 3 prompts, got ${prompts.length}. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
