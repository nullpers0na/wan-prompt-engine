const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a WAN2.2 motion prompt writer. Write 5 short, punchy sequential prompts — one per ~4 second clip segment.

Keep every prompt to ONE sentence. Short is everything. WAN2.2 generates better video from short prompts.

Rules:
- ONE sentence per prompt. No more.
- Action verb first, present tense: "her breasts bounce slowly" not "bouncing breasts"
- Describe motion only — NOT appearance. WAN2.2 reads the source image for looks
- NO camera movement ever — no panning, zooming, tracking, dolly, handheld. Camera is always locked
- End every prompt with: camera locked, face locked, static scene
- If feet or toes are mentioned, add: stable feet, anatomically correct
- When cum or semen is mentioned: creamy white, thick, opaque, dripping
- Separate prompts with a blank line only — no labels, numbers, or headers`;

// Extract "remember X" clauses and return { cleaned description, remember clauses[] }
function extractRemember(description) {
  const clauses = [];
  const cleaned = description.replace(/\bremember\s+(?:to\s+)?([^,.!?\n]+)/gi, (_, clause) => {
    clauses.push(clause.trim());
    return '';
  }).replace(/,\s*,/g, ',').replace(/,\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  return { cleaned, clauses };
}

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

    const { cleaned, clauses } = extractRemember(description);

    let systemPrompt = SYSTEM_PROMPT;
    if (clauses.length) {
      const constraints = clauses.join(', ');
      systemPrompt += `\n- PERSISTENT CONSTRAINT (append to every prompt, after all other tags): , ${constraints}`;
    }

    const text = await callOpenRouter(
      systemPrompt,
      buildUserContent(cleaned || description, image),
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
