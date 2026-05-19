const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert prompt engineer for Qwen AI image editing models.

RULES — follow exactly:
- Output exactly 3 prompts
- Each prompt on its own line
- No numbering, no bullet points, no labels, no blank lines, no preamble, no commentary
- Prompt 1: concise direct instruction (under 15 words)
- Prompt 2: detailed description of what to change, preserve, and the desired result
- Prompt 3: version with specific style, lighting, or quality guidance

OUTPUT FORMAT (3 lines, nothing else):
<prompt 1>
<prompt 2>
<prompt 3>`;

function parsePrompts(text, count) {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^[\s\d.\-*>]+/, '').trim()) // strip leading numbers/bullets
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userContent = image
    ? [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        { type: 'text', text: description.trim() },
      ]
    : description.trim();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = message.content[0].text.trim();
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
