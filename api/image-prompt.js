const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert prompt engineer for Qwen AI image editing models. Given a description of an image edit, output exactly 3 prompt variations, one per line, no labels, no blank lines.
Variation 1: A concise, direct instruction (under 15 words).
Variation 2: A detailed description including what to change, preserve, and the desired result.
Variation 3: A version with specific style, lighting, or quality guidance.
Output ONLY the 3 prompts.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description.trim() }],
    });

    const text = message.content[0].text.trim();
    const prompts = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (prompts.length !== 3) {
      return res.status(500).json({ error: `Expected 3 prompts, got ${prompts.length}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
