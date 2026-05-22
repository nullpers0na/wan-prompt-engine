const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a WAN2.2 motion physics assistant. The user has written their scene — your job is to write 5 sequential motion physics variations, one per ~4 second clip segment.

Each segment = one line of comma-separated physics tags only (motion, intensity, angle, timing).
Separate segments with a blank line.
Do NOT repeat the user's description words. Physics tags only.

Examples: slow motion, heavy ripple, upward bounce, lateral sway, extreme close-up, wide shot, jiggle settling, soft-body physics, rhythmic motion, building intensity

Rules:
- 3 to 6 tags per segment, vary across the 5 (build, peak, slow, zoom, settle)
- If feet or toes are in the description: include stable feet, anatomically correct
- If cum or semen is in the description: include creamy white, thick, opaque, dripping
- No camera movement tags — camera is always locked
- No labels, numbers, or headers — blank line between segments only`;

// Extract "remember X" clauses and return { cleaned description, remember clauses[] }
function extractRemember(description) {
  const clauses = [];
  const cleaned = description.replace(/\bremember\s+(?:to\s+)?([^,.!?\n]+)/gi, (_, clause) => {
    clauses.push(clause.trim());
    return '';
  }).replace(/,\s*,/g, ',').replace(/,\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  return { cleaned, clauses };
}

function parsePhysicsTags(text) {
  const byBlank = text.split(/\n\s*\n/).map(block =>
    block.split('\n').map(l => l.replace(/^[\s*#\-\d.)\]]+/, '').trim()).filter(Boolean).join(', ')
  ).filter(b => b.length > 3);
  if (byBlank.length >= 5) return byBlank.slice(0, 5);
  return text.split('\n')
    .map(l => l.replace(/^[\s*#\-\d.)\]]+/, '').trim())
    .filter(l => l.length > 3).slice(0, 5);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, characterContext, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const { cleaned, clauses } = extractRemember(description);
    const base = (cleaned || description).trim().replace(/[.!]+$/, '');

    // Give LLM character context so physics tags are appropriate, but only user's text becomes the base
    const llmInput = characterContext
      ? `Character: ${characterContext}\n\nScene: ${cleaned || description}`
      : `Scene: ${cleaned || description}`;

    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(llmInput, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 600 },
    );

    const physicsList = parsePhysicsTags(text);
    if (physicsList.length !== 5) {
      return res.status(500).json({ error: `Expected 5 segments, got ${physicsList.length}. Raw: ${text.slice(0, 200)}` });
    }

    const suffix = clauses.length ? ', ' + clauses.join(', ') : '';
    const prompts = physicsList.map(physics =>
      `${base}, ${physics}, camera locked, face locked, static scene${suffix}`
    );

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
