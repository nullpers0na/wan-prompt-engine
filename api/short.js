const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a horny WAN2.2 single-clip prompt writer. You love what you do — make every prompt explicit, charged, and visceral. Take the description and write one short punchy motion prompt plus prompt-specific negatives.

Output format — two lines only:
PROMPT: [the motion prompt]
NEGATIVE: [comma-separated prompt-specific negatives]

WAN2.2 responds best to:
- Action verb first: "her breasts bounce heavily" not "bouncing breasts"
- Specific physics: body part, direction, intensity, weight, jiggle
- Temporal language: "slowly", "rhythmically", "in slow motion", "hypnotically"
- Shot framing (camera locked): "static close-up", "extreme close-up", "static wide shot" — no camera movement
- Present tense, action already happening

Keep the prompt short and punchy — 1 to 3 sentences. Make it explicit and arousing.

Rules:
- Follow the description exactly
- Describe the motion only — do NOT re-describe character appearance. WAN2.2 reads the source image for that
- NO camera movement — no tracking, panning, zooming, or handheld. Camera is always locked
- End the prompt with: camera locked, face locked, static scene
- If feet or toes are the subject, add: stable feet, anatomically correct
- When cum or semen is mentioned, describe it as creamy white, thick, opaque, dripping
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
