const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a WAN2.2 motion physics assistant. The user has written their prompt — your job is to add technical WAN2.2 physics tags and negatives only.

Output format — two lines only:
PHYSICS: [comma-separated motion physics additions only — e.g. "slow motion, soft-body jiggle, heavy ripple, rhythmic bounce". Do NOT repeat anything already in the description]
NEGATIVE: [comma-separated prompt-specific negatives]

Rules:
- PHYSICS line: additions only, no repetition of the user's words
- If feet or toes are the subject, include: stable feet, anatomically correct
- NEGATIVE line: prompt-specific terms only — general negatives are added by the UI
- Keep PHYSICS short — 3 to 6 tags`;

function parseResponse(text) {
  const physicsMatch = text.match(/^PHYSICS:\s*(.+)/im);
  const negativeMatch = text.match(/^NEGATIVE:\s*(.+)/im);
  const physics = physicsMatch ? physicsMatch[1].trim() : '';
  const negative = negativeMatch ? negativeMatch[1].trim() : '';
  return { physics, negative };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, characterContext, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const base = description.trim().replace(/[.!]+$/, '');

    // Give LLM character context so physics tags are appropriate, but only the user's text becomes the base
    const llmInput = characterContext
      ? `Character: ${characterContext}\n\nUser prompt: ${description}`
      : description;

    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(llmInput, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 200 },
    );

    const { physics, negative } = parseResponse(text);

    const CAMERA_MOVEMENT_RE = /\b(zoom|pan|tilt|dolly|orbit|track|pull.?back|push.?in|crane|follow|sweep|rotate|circl|drift|slide|handheld|whip)\b/i;
    const hasCameraMove = CAMERA_MOVEMENT_RE.test(description);
    const cameraSuffix = hasCameraMove ? ', face locked' : ', camera locked, face locked, static scene';

    const prompt = physics
      ? `${base}, ${physics}${cameraSuffix}`
      : `${base}${cameraSuffix}`;

    res.json({ prompts: [prompt], negative });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
