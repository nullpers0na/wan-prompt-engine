const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert prompt engineer for WAN2.2 image-to-video generation.

RULES — follow exactly:
- Output exactly 5 prompts
- Each prompt on its own line
- No numbering, no bullet points, no labels, no blank lines, no preamble, no commentary
- Each prompt controls ~4 seconds of video in chronological order
- Present tense, action already happening, include shot type, camera behaviour, body motion, energy

OUTPUT FORMAT (5 lines, nothing else):
<prompt 1>
<prompt 2>
<prompt 3>
<prompt 4>
<prompt 5>`;

function parsePrompts(text, count) {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^[\s\d.\-*>]+/, '').trim()) // strip leading numbers/bullets
    .filter(l => l.length > 20); // real prompts are never trivially short
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
