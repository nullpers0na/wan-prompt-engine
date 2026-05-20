const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a motion prompt writer for WAN2.2, an image-to-video AI. Take a scene description and write 5 sequential prompts — one per ~4 second video segment — describing exactly what the camera sees and what is physically moving.

Rules:
- The text description is your only source of content — follow it exactly
- If a character description is provided, extract only 1–2 key identifying words (e.g. "brunette", "tattooed redhead") — do not reproduce the full character description in the prompt
- The image is secondary context only; never add anything from it that isn't in the description
- Never mention footwear (shoes, heels, boots, sandals, slippers, socks, bare feet included) or clothing unless the user explicitly asks for it
- Present tense, action already happening
- Match length to complexity: simple actions get concise prompts; complex motion gets more detail
- Include shot type, camera behaviour, and body motion only when they add meaningful clarity
- For physics be precise: which body part, direction, intensity
- Only describe nipple and areola appearance (size, colour) if the description explicitly mentions breasts, chest, nipples, or areolas — never infer or add it otherwise
- When cum or semen is mentioned, always describe it as creamy white, thick, opaque
- Separate each prompt with a blank line only — absolutely no labels, numbers, headers, or asterisks of any kind`;

function parsePrompts(text) {
  const byBlank = text.split(/\n\s*\n/).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    // Drop a first line that is purely a label (e.g. "Prompt 1:**", "**1.**", "Segment 2:")
    if (lines.length > 1 && /^[\s*#]*(?:prompt|segment)?\s*\d+\W*$/i.test(lines[0])) lines.shift();
    // Also strip any inline label prefix from the first remaining line
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

    const prompts = parsePrompts(text).map(p => `${p}, same face throughout, consistent identity`);
    if (prompts.length !== 5) {
      return res.status(500).json({ error: `Expected 5 prompts, got ${prompts.length}. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
