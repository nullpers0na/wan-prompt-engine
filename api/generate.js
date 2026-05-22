const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a WAN2.2 motion sequencer. Given a scene, write exactly 5 motion physics lines — one per video segment (~4s each).

Output format: exactly 5 numbered lines, nothing else.
1. [motion tags]
2. [motion tags]
3. [motion tags]
4. [motion tags]
5. [motion tags]

Each line = comma-separated motion/physics tags only. Follow this narrative arc:
1. Establish — initial motion, settling into the action, set the tone
2. Continue — motion develops, rhythm builds, expression shifts
3. Escalate — action intensifies, body response increases
4. Peak — maximum intensity, strongest motion, most explicit moment
5. Resolve — motion slows, weight settles, lingering afterglow

Rules:
- Motion tags only — do NOT repeat the scene description words
- Camera is ALWAYS locked and static — no panning, tracking, zooming, orbiting
- 3 to 6 tags per line
- If feet or toes are in the scene: include stable feet, anatomically correct
- If cum or semen is in the scene: include creamy white, thick, opaque, dripping
- No headers, no blank lines, no labels beyond the 1–5 numbers`;

// Extract "remember X" clauses
function extractRemember(description) {
  const clauses = [];
  const cleaned = description.replace(/\bremember\s+(?:to\s+)?([^,.!?\n]+)/gi, (_, clause) => {
    clauses.push(clause.trim());
    return '';
  }).replace(/,\s*,/g, ',').replace(/,\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  return { cleaned, clauses };
}

function parseLines(text) {
  return text
    .split('\n')
    .map(l => l.replace(/^\s*\d+[\.\)]\s*/, '').trim())
    .filter(l => l.length > 3)
    .slice(0, 5);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, characterContext, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const { cleaned, clauses } = extractRemember(description);
    const base = (cleaned || description).trim().replace(/[.!]+$/, '');

    const llmInput = characterContext
      ? `Character: ${characterContext}\n\nScene: ${cleaned || description}`
      : `Scene: ${cleaned || description}`;

    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(llmInput, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 400 },
    );

    const physicsList = parseLines(text);
    if (physicsList.length !== 5) {
      return res.status(500).json({ error: `Expected 5 prompts, got ${physicsList.length}. Raw: ${text.slice(0, 300)}` });
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
