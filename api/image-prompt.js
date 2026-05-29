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

const SYSTEM_PROMPT = `You are a prompt writer for Phr00t Qwen-Image-Edit-Rapid-AIO v18.1 NSFW running in ComfyUI.

Model characteristics:
- Natural language prompts work best — not keyword stacks
- CFG 1.0, 8 steps, euler_ancestral/beta sampler — negatives are inert at CFG 1.0, so put all preservation in the positive prompt
- Model is aggressive with body changes — be explicit about keeping things proportional
- Reference the source image as <image_1> if needed

Rules:
- Write 1-4 clear sentences following this structure: (1) state the change, (2) add size/proportion constraints if relevant, (3) add camera/composition preservation if it's a structural edit, (4) end with face preservation
- Preserve the user's exact adjectives — never soften, substitute, or change the meaning
- Do NOT use "don't change the face" — use "Preserve her face exactly." as the closing sentence instead
- Do NOT use the word "texture" — use "details" instead
- Do NOT use "photograph" or "photorealistic"
- Do not add physical descriptors the user did not mention
- If LoRA trigger phrases are provided, embed them verbatim
- No preamble, no commentary — just the sentences

Example outputs:
- Sag: Her breasts hang low and sag heavily, same size as original. Same pose, camera, and composition. Preserve her face exactly.
- Subtle: The nipples and areolas angle downward naturally following the sagging breasts. Keep everything else completely unchanged.
- Size: Reduce the breast size slightly so it looks more proportional, keeping the same saggy shape. Same pose and composition. Preserve her face exactly.`;

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
      : 'Preserve her face exactly.';

    // Detect LoRA triggers
    const triggers = loraEnabled
      ? LORA_TRIGGERS.filter(t => baseLower.includes(t))
      : [];

    // Build LLM user message
    const parts = [`Edit request: ${normalized}`];
    if (characterContext) parts.unshift(`Character context: ${characterContext}\n`);

    // If saggy/droopy detected, constrain to prevent the model inverting it
    if (BREAST_SHAPE_OVERRIDES.some(({ detect }) => detect.test(normalized))) {
      parts.push(`\nBreast shape constraint: describe the breasts as hanging low, sagging heavily. Preserve the user's exact adjectives. Never use "lifted", "firm", "perky", or any upward description.`);
    }

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
