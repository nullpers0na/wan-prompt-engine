const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a LoRA tag assistant for Qwen image editing. Output only the relevant LoRA trigger words and quality tags for the user's edit request.

Output format — two lines only:
LORA: [only trigger words that directly apply — leave blank if none apply]
QUALITY: [2-3 quality tags]

Available LoRA triggers — only include ones the edit request explicitly calls for:
Breast size: "tiny breasts" | "small breasts" | "medium breasts" | "large breasts"
Areola size: "tiny areoles" | "small areoles" | "medium areoles" | "large areoles" | "medium sized areoles"
Areola colour: "pale areoles" | "ghost areoles" | "brown areoles" | "dark areoles"
Nipple state: "hard nipples" | "erect nipples"

Rules:
- Only include a trigger if the edit request explicitly mentions that feature
- Do NOT add areola/nipple triggers if the user only mentioned breast shape
- QUALITY: e.g. "photorealistic, detailed, sharp focus"
- No sentences, no explanations`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, characterContext, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    // Only user's edit text becomes the base — character context is LLM-only
    const base = description.trim().replace(/[.!]+$/, '');
    const llmInput = characterContext
      ? `Character context: ${characterContext}\n\nEdit request: ${description}`
      : description;

    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(llmInput, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 150 },
    );

    const loraMatch    = text.match(/^LORA:\s*(.*)/im);
    const qualityMatch = text.match(/^QUALITY:\s*(.*)/im);
    const lora    = loraMatch    ? loraMatch[1].trim()    : '';
    const quality = qualityMatch ? qualityMatch[1].trim() : '';

    const parts = [base];
    if (lora) {
      const baseLower = base.toLowerCase();
      const newTags = lora.split(',').map(t => t.trim()).filter(t => t && !baseLower.includes(t.toLowerCase()));
      if (newTags.length) parts.push(newTags.join(', '));
    }
    if (quality) parts.push(quality);
    parts.push('preserve the original face exactly');

    res.json({ prompts: [parts.join(', ')] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
