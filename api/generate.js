const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are an expert motion prompt writer for WAN2.2 image-to-video AI. Take the scene description and write 5 sequential prompts, one per ~4 second segment.

WAN2.2 responds best to:
- Action verb first: "her breasts bounce heavily" not "bouncing breasts"
- Specific physics: which body part, direction, intensity, weight
- Temporal pacing: "slowly", "rhythmically", "building intensity", "in slow motion"
- Camera and shot type when they add clarity: "static close-up", "tracking shot from behind", "overhead"
- Present tense, action already happening

Each prompt should paint a precise picture of what the camera sees and what is physically moving. Be vivid and specific. Build naturally across the 5 segments — vary pacing, angle, or intensity to create progression.

Rules:
- Follow the description exactly — it is your only content source
- Describe the motion and camera only — do NOT re-describe character appearance (body, hair, skin, outfit, expression). WAN2.2 reads the source image for that
- End every prompt with: face locked, static scene
- If feet or toes are the subject, add: stable feet, anatomically correct
- When cum or semen is mentioned, describe it as creamy white, thick, opaque
- Separate prompts with a blank line only — no labels, numbers, or headers`;

function parsePrompts(text) {
  const byBlank = text.split(/\n\s*\n/).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 1 && /^[\s*#]*(?:prompt|segment)?\s*\d+\W*$/i.test(lines[0])) lines.shift();
    if (lines.length) lines[0] = lines[0].replace(/^[\s*#]*(?:prompt|segment)?\s*\d+\s*[:\-*#.)\]]+\s*/i, '').trim();
    return lines.join(' ').trim();
  }).filter(b => b.length > 20);
  if (byBlank.length >= 5) return byBlank.slice(0, 5);
  return text.split('\n')
    .map(l => l.replace(/^[\s*#]*(?:prompt|segment)?\s*\d+\s*[:\-*#.)\]]+\s*/i, '').trim())
    .filter(l => l.length > 20).slice(0, 5);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 1024 },
    );

    const prompts = parsePrompts(text);
    if (prompts.length !== 5) {
      return res.status(500).json({ error: `Expected 5 prompts, got ${prompts.length}. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
