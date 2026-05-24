const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const LORA_TRIGGERS = [
  'tiny breasts', 'small breasts', 'medium breasts', 'large breasts',
  'tiny areoles', 'small areoles', 'medium areoles', 'large areoles', 'medium sized areoles',
  'pale areoles', 'ghost areoles', 'brown areoles', 'dark areoles',
  'hard nipples', 'erect nipples',
];

// When detected, bypass LLM for breast shape and use this sentence verbatim
const BREAST_SHAPE_OVERRIDES = [
  {
    detect: /\b(saggy|droopy|hanging|pendulous)\b/i,
    sentence: 'Make the breasts naturally saggy, hanging low with nipples pointing downward.',
  },
];

const SYSTEM_PROMPT = `You are a Qwen image edit prompt writer. Convert the edit request into 2-4 clear instructional sentences.

Qwen uses a language model as its text encoder — it responds to clear instructions, not comma-separated keyword lists.

Rules:
- Write as direct instructions: "Make...", "Change...", "Transform...", "Add...", "Keep..."
- Preserve the user's exact adjectives and intent — never soften, substitute, or change the meaning
- Do not add physical detail descriptors the user did not mention (no skin texture, skin folds, weight descriptions, etc.)
- If LoRA trigger phrases are provided, embed them verbatim within a sentence
- End with exactly: Preserve the original face exactly.
- No preamble, no commentary — just the sentences`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, characterContext, image, loraEnabled = true } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    // Replace "image 2" / "image 1" with <image_2> / <image_1> syntax
    const normalized = description.trim()
      .replace(/\bimage\s+2\b/gi, '<image_2>')
      .replace(/\bimage\s+1\b/gi, '<image_1>');
    const isMultiImage = normalized.includes('<image_2>') || normalized.includes('<image_1>');
    const baseLower = normalized.toLowerCase();

    const ending = isMultiImage
      ? 'Keep the exact style, rendering, lighting and aesthetic of <image_1> unchanged.'
      : 'Preserve the original face exactly.';

    // Detect LoRA triggers
    const triggers = loraEnabled
      ? LORA_TRIGGERS.filter(t => baseLower.includes(t))
      : [];

    // Check for breast shape override — bypass LLM entirely to avoid contradictions
    const breastOverride = BREAST_SHAPE_OVERRIDES.find(({ detect }) => detect.test(normalized));
    if (breastOverride) {
      const parts = [breastOverride.sentence];
      if (triggers.length) parts.push(`Use these LoRA terms: ${triggers.join(', ')}.`);
      parts.push(ending);
      return res.json({ prompts: [parts.join(' ')] });
    }

    // Build LLM user message
    const parts = [`Edit request: ${normalized}`];
    if (characterContext) parts.unshift(`Character context: ${characterContext}\n`);
    if (triggers.length) parts.push(`\nLoRA trigger phrases to embed verbatim: ${triggers.join(', ')}`);
    parts.push(`\nEnd with: ${ending}`);

    const prompt = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(parts.join('\n'), image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 200 },
    );

    res.json({ prompts: [prompt.trim()] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
