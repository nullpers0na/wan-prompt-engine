const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a WAN2.2 single-clip prompt writer. Take the user's description and write one short, punchy motion prompt — a few words to two short sentences at most. Think: "breasts jiggle as she walks toward camera, fixed shot" or "heavy breast bounce, slow motion, jiggle physics, natural weight".

Rules:
- The text description is your only source of content — follow it exactly
- If a character description is provided, extract only 1–2 key identifying words (e.g. "brunette", "tattooed redhead") — do not reproduce the full character description in the prompt
- Never mention footwear (shoes, heels, boots, sandals, slippers, socks, bare feet included) or clothing unless the user explicitly asks for it
- Output one prompt only — no labels, no commentary
- Keep it extremely short: comma-separated descriptors or 1–2 short sentences maximum
- Focus on the specific motion, physics, and camera — be precise about body part, direction, intensity
- Present tense, action already happening
- If the user says the face shouldn't change, move, or shift, translate that as: "face locked, static expression, no facial movement or deformation"
- Always include "face locked, static expression, no facial movement or deformation" unless the user explicitly asks for facial movement or expression changes
- No elaborate scene-setting, no quality tags, no filler
- When cum or semen is mentioned, always describe it as creamy white, thick, opaque`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 256 },
    );

    const prompt = text
      .replace(/^[\s*#]*(?:prompt|clip)?\s*\d*\s*[:\-*#.)\]"'`]+\s*/i, '')
      .replace(/^["'`]+/, '')
      .trim();
    if (prompt.length < 5) {
      return res.status(500).json({ error: `Empty response. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts: [prompt] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
