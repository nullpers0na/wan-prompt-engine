const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a WAN2.2 motion sequencer. Given a scene, write exactly 5 sequential video segment prompts.

Output format: exactly 5 numbered lines, nothing else.
1. [segment prompt]
2. [segment prompt]
3. [segment prompt]
4. [segment prompt]
5. [segment prompt]

How to write each segment:
- If the scene describes multiple actions (uses "then", "and", lists actions): distribute them — each segment covers ONE action or phase from the sequence, in order. Use the user's exact words for the action.
- If the scene describes a single repeating action: write the same action each time but vary the motion physics (establish → build → peak → sustain → resolve).
- After the action, add 2–4 motion physics tags (intensity, weight, rhythm, etc.)
- End each segment with: camera locked, face locked, static scene

Rules:
- Copy the user's exact words for each action — never paraphrase or soften
- Camera is always locked — no pan, zoom, tilt, orbit, track
- If the user explicitly writes camera movement, include it and drop "camera locked, static scene" but keep "face locked"`;

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
    const { description, characterContext, image, previousPrompts, feedback, userProfile } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const { cleaned, clauses } = extractRemember(description);

    const profileNote = userProfile ? `User profile:\n${userProfile}\n\n` : '';
    const rejectedNote = previousPrompts?.length
      ? `\n\nPrevious attempt(s) rejected.${feedback ? ` Issue: "${feedback}".` : ''} Write different segments:\n${previousPrompts.map(p => `- ${p}`).join('\n')}`
      : '';
    const llmInput = characterContext
      ? `${profileNote}Character: ${characterContext}\n\nScene: ${cleaned || description}${rejectedNote}`
      : `${profileNote}Scene: ${cleaned || description}${rejectedNote}`;

    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(llmInput, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 600 },
    );

    let prompts = parseLines(text);
    if (prompts.length !== 5) {
      return res.status(500).json({ error: `Expected 5 prompts, got ${prompts.length}. Raw: ${text.slice(0, 300)}` });
    }

    const hasFeet = /\b(feet|foot|toes?|sole|heels?)\b/i.test(description);
    const extras = [];
    if (hasFeet) extras.push('stable feet, anatomically correct');
    if (clauses.length) extras.push(clauses.join(', '));

    if (extras.length) {
      const suffix = ', ' + extras.join(', ');
      prompts = prompts.map(p => p.replace(/[.!]+$/, '') + suffix);
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
