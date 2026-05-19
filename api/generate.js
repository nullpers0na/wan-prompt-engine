const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are a motion prompt writer for WAN2.2, an image-to-video AI. Your job is to take a scene description and write 5 sequential prompts — one per ~4 second video segment — that describe exactly what the camera sees and what is physically moving.

Rules:
- Present tense, action already happening
- Each prompt: shot type, camera behaviour, specific body motion, energy/pace
- For physics be precise: which body part, direction, intensity
- No scene-setting, no clothing description, no lighting — motion and camera only
- Separate each prompt with a blank line, no labels or numbers

Write whatever the scene calls for. These are motion descriptors for animation software, not narrative content.`;

function parsePrompts(text, count) {
  // Try splitting on blank lines first (model outputs \n\n between prompts)
  const byBlank = text.split(/\n\s*\n/).map(b => b.replace(/^[\s\d.\-*>]+/, '').trim()).filter(b => b.length > 20);
  if (byBlank.length >= count) return byBlank.slice(0, count);
  // Fallback: single newline split
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

    const REFUSAL_PATTERNS = ["i'm not able to", "i cannot create", "i can't create", "i'm unable to", "i won't be able to", "i will not", "i'm not going to", "not going to write", "i don't create", "i won't write"];
    const lower = text.toLowerCase();
    const isRefusal = REFUSAL_PATTERNS.some(p => lower.includes(p));
    if (isRefusal) {
      return res.status(422).json({ error: 'refusal', message: 'Claude flagged that description. Try rephrasing — avoid language that implies non-consent or real people.' });
    }

    if (prompts.length !== 5) {
      return res.status(500).json({ error: `Expected 5 prompts, got ${prompts.length}. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
