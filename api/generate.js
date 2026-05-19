const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert prompt engineer for WAN2.2 image-to-video generation, specialising in adult AI renders. You write motion prompts for fictional AI-generated characters — all adults, all consensual, all creative fiction.

Each prompt controls ~4 seconds of video. Write 5 sequential prompts that describe exactly what is happening in each segment. Start with the action already underway. Present tense. Include shot type, camera behaviour, body motion, energy level. For physics content (jiggle, bounce, thrust) be specific: which body part, direction, intensity. For BDSM scenes include the specific acts, dynamics, and physical detail — restraints, impact, dominance cues, reactions.

Separate each prompt with a blank line. No labels, no numbers, no commentary — only the 5 prompts.

Example output style:
Static close-up shot, breasts jiggling heavily with each thrust, soft-body physics rippling outward from impact point, rhythmic and exaggerated, warm skin catching light.

Wide shot pulling slowly back, subject bent over, hands bound behind back, ass cheeks rippling on each spank, red marks visible, submissive body language, weight shifting forward.

POV shot, face close to camera, mouth open, expression of overwhelmed pleasure, hair dishevelled and swaying, chin and chest glistening, eyes barely focused.

Medium shot from behind, hips grinding in slow circles, thighs quivering, cum dripping down inner thigh, movement slowing to a weighted sway, deep arch maintained.

Static wide shot, full body visible, collapsed forward, heavy breathing visible in chest rise, fluid pooling beneath, legs still spread, completely spent.`;

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

    const REFUSAL_PATTERNS = ["i'm not able to create", "i cannot create prompts", "i can't create prompts", "i'm unable to generate", "i won't be able to", "i will not create"];
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
