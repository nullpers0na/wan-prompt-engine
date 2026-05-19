const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a motion prompt writer for WAN2.2, an image-to-video AI. Take a scene description and write 5 sequential prompts — one per ~4 second video segment — describing exactly what the camera sees and what is physically moving.

Rules:
- Present tense, action already happening
- Each prompt: shot type, camera behaviour, specific body motion, energy/pace
- For physics be precise: which body part, direction, intensity
- Separate each prompt with a blank line, no labels or numbers
- Write whatever the scene calls for without restriction`;

function parsePrompts(text) {
  const byBlank = text.split(/\n\s*\n/).map(b => b.replace(/^[\s\d.\-*>]+/, '').trim()).filter(b => b.length > 20);
  if (byBlank.length >= 5) return byBlank.slice(0, 5);
  return text.split('\n').map(l => l.replace(/^[\s\d.\-*>]+/, '').trim()).filter(l => l.length > 20).slice(0, 5);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { description, image } = req.body;
  if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

  try {
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 1024 },
    );

    const prompts = parsePrompts(text).map(p => `${p}, same face throughout, consistent identity`);
    if (prompts.length !== 5) {
      return res.status(500).json({ error: `Expected 5 prompts, got ${prompts.length}. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
