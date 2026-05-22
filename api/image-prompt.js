const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a LoRA tag assistant for Qwen image editing. The user has written their edit request — your job is to output only the relevant LoRA trigger words that apply, plus 2-3 quality tags.

Output format — two lines only:
LORA: [only the trigger words that apply, comma-separated — leave blank if none apply]
QUALITY: [2-3 quality tags relevant to this edit]

Available LoRA trigger words — only include ones directly relevant to the user's request:
Breast size: "tiny breasts" | "small breasts" | "medium breasts" | "large breasts"
Areola size: "tiny areoles" | "small areoles" | "medium areoles" | "large areoles" | "medium sized areoles"
Areola colour: "pale areoles" | "ghost areoles" | "brown areoles" | "dark areoles"
Nipple state: "hard nipples" | "erect nipples"

Rules:
- Only include a LoRA trigger if the user's description explicitly mentions that feature
- Do NOT invent areola/nipple tags if the user only mentioned breast shape/size
- QUALITY line: short descriptors like "photorealistic, detailed, sharp focus"
- No sentences, no explanations, no labels beyond the two output lines`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, image } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(description, image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 150 },
    );

    const loraMatch    = text.match(/^LORA:\s*(.*)/im);
    const qualityMatch = text.match(/^QUALITY:\s*(.*)/im);
    const lora    = loraMatch    ? loraMatch[1].trim()    : '';
    const quality = qualityMatch ? qualityMatch[1].trim() : '';

    const base = description.trim().replace(/[.!]+$/, '');
    const baseLower = base.toLowerCase();
    const parts = [base];
    // only add LoRA tags not already present in the user's description
    if (lora) {
      const newTags = lora.split(',').map(t => t.trim()).filter(t => t && !baseLower.includes(t.toLowerCase()));
      if (newTags.length) parts.push(newTags.join(', '));
    }
    if (quality) parts.push(quality);
    parts.push('preserve the original face exactly');

    const prompt = parts.join(', ');
    res.json({ prompts: [prompt] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
