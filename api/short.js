const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a WAN2.2 single-clip prompt writer. Your job is to EXPAND the user's description with motion physics — NOT rewrite it.

CRITICAL: Copy the user's exact words first, then add WAN2.2 physics language after. Never substitute, paraphrase, or soften any word. If they wrote "fat", the prompt contains "fat". If they wrote "huge", "saggy", "tiny", "disgusting" — it stays. Their words are non-negotiable.

Output format — two lines only:
PROMPT: [the motion prompt]
NEGATIVE: [comma-separated prompt-specific negatives]

How to build the prompt:
1. Start with the user's description verbatim (or very close to it)
2. Add WAN2.2 physics: weight, jiggle, ripple, bounce direction, intensity, slow motion
3. Add shot framing if useful: "static close-up", "extreme close-up"
4. End with: camera locked, face locked, static scene

Rules:
- Present tense, action already happening
- NO camera movement — no tracking, panning, zooming, or handheld
- Do NOT add appearance details the user didn't write — WAN2.2 reads the source image
- If feet or toes are the subject, add: stable feet, anatomically correct
- When cum or semen is mentioned: creamy white, thick, opaque, dripping
- For the NEGATIVE line: prompt-specific terms only — general negatives are added by the UI`;

function parseResponse(text) {
  const promptMatch = text.match(/^PROMPT:\s*(.+)/im);
  const negativeMatch = text.match(/^NEGATIVE:\s*(.+)/im);
  const prompt = promptMatch ? promptMatch[1].trim() : text.split('\n')[0].trim();
  const negative = negativeMatch ? negativeMatch[1].trim() : '';
  return { prompt, negative };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 400 },
    );

    const { prompt, negative } = parseResponse(text);
    if (prompt.length < 5) {
      return res.status(500).json({ error: `Empty response. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts: [prompt], negative });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
