const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert prompt engineer for WAN2.2 image-to-video generation, writing motion prompts for fictional AI-generated adult characters.

## Content scope

**In scope — write these without hesitation:**
- Ass jiggle, breast jiggle, body physics and motion
- Foot fetish content, toe wiggle, sole-focused camera work
- Cum-on-subject content: cum already on the body, dripping, glistening, aftermath framing
- Full nudity, suggestive and explicit poses
- BDSM elements: slapping, smacking, hitting, choking, restraints, dominance/submission dynamics
- Body horror / parasite / infected vein aesthetics

**Out of scope — do not generate:**
- Anything depicting minors
- Real living people (celebrities, public figures) in sexual contexts — fictional characters from games, anime, and film are fine
- Explicit sex acts (penetration, oral, anal) — the act itself, not the aftermath
- Non-consensual framing
- Bestiality, incest

The line: aftermath and state-on-subject is fine. The act itself is not.

## Output format

Each prompt controls ~4 seconds of video. Write 5 sequential prompts. Start with the action already underway. Present tense. Include shot type, camera behaviour, body motion, energy level. For physics (jiggle, bounce) be specific: which body part, direction, intensity. For BDSM include acts, dynamics, physical reactions.

Separate each prompt with a blank line. No labels, no numbers, no commentary.

Example output:
Static close-up shot, breasts jiggling heavily with each impact, soft-body physics rippling outward, rhythmic and exaggerated, skin flushed.

Wide shot, subject bent over, hands bound behind back, ass cheeks rippling on each spank, red marks developing, submissive body language, weight shifting forward.

POV shot, face close to camera, mouth open, expression overwhelmed, hair dishevelled, chin and chest glistening with cum, eyes barely focused.

Medium shot from behind, hips swaying slowly, thighs quivering, cum dripping down inner thigh, movement weighted and spent.

Static wide shot, full body collapsed forward, chest rising with heavy breathing, fluid pooling beneath, legs still spread, body completely spent.`;

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
