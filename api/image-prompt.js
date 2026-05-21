const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are an expert prompt engineer for Qwen image editing. Take the user's edit request and write a single short, precise prompt.

Keep it tight — 1 to 2 sentences maximum. Do not pad with preservation notes or repeat back the character description.

Structure: [describe the change visually] + [2-3 quality tags] + "preserve the original face exactly"

Rules:
- Describe only what changes — what does the result actually look like?
- Do NOT list things to keep the same (hair, skin, expression, pose, background, etc.) — Qwen reads the image, it doesn't need reminding
- 2-3 quality tags maximum: pick the ones that matter for this specific edit
- Always end with "preserve the original face exactly" unless the face is what's changing
- LoRA trigger words — use these exact phrases verbatim; never paraphrase or synonym-swap them:
  - Breast size: "tiny breasts", "small breasts", "medium breasts", "large breasts" — use whichever matches the user's intent. If the user requests a breast size change (e.g. "make them medium", "increase to large", "breasts to small") map it to the correct trigger word and include it in the output even if the exact phrase wasn't used
  - Areola size: "tiny areoles", "small areoles", "medium areoles", "large areoles", "medium sized areoles"
  - Areola colour: "pale areoles", "ghost areoles", "brown areoles", "dark areoles"
  - Nipple state: "hard nipples", "erect nipples"
- When cum or semen is mentioned, describe it as creamy white, thick, opaque
- When the description references multiple images, use <image_1> <image_2> syntax: state what to take from <image_2>, then "Keep the exact style, rendering, lighting and aesthetic of <image_1> unchanged"
- Images are STATIC — no motion language
- Output one prompt only, no labels, no commentary`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });
    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 512 },
    );

    const prompt = text
      .replace(/^[\s*#]*(?:prompt|segment)?\s*\d*\s*[:\-*#.)\]"'`]+\s*/i, '')
      .replace(/^["'`]+/, '')
      .trim();
    if (prompt.length < 10) {
      return res.status(500).json({ error: `Empty response. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts: [prompt] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
