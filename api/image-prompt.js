const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const LORA_TRIGGERS = [
  'tiny breasts', 'small breasts', 'medium breasts', 'large breasts',
  'tiny areoles', 'small areoles', 'medium areoles', 'large areoles', 'medium sized areoles',
  'pale areoles', 'ghost areoles', 'brown areoles', 'dark areoles',
  'hard nipples', 'erect nipples',
];


const SYSTEM_PROMPT = `You are a prompt writer for Phr00t Qwen-Image-Edit-Rapid-AIO v18.1 NSFW running in ComfyUI.

Model characteristics:
- CFG 1.0 — negatives are inert, put all preservation in the positive prompt
- Model is aggressive — keep prompts short and focused, do NOT over-specify
- Do NOT use "don't change the face" — end with "Preserve her face exactly." instead
- Do NOT use the word "texture" — use "details" instead
- Do NOT use "photograph" or "photorealistic"

Rules:
- Write 1-2 sentences only: (1) state the change clearly, (2) end with "Preserve her face exactly."
- Only mention things the user explicitly asked to change — do not add preservation notes for body parts, skin, pose, or clothing the user did not mention
- Preserve the user's exact adjectives — never soften, invert, or substitute
- If the user says saggy/droopy/hanging, describe them that way — never write "rounded", "lifted", "firm", or "perky"
- If LoRA trigger phrases are provided, embed them verbatim
- No preamble, no commentary — just the sentences

Examples:
User: her breasts are saggy
Output: Her breasts are saggy, hanging low. Preserve her face exactly.

User: her breasts are slightly saggy
Output: Her breasts are slightly saggy, hanging low. Preserve her face exactly.

User: make her breasts large and droopy
Output: Her breasts are large and droopy, hanging low. Preserve her face exactly.

User: bigger breasts
Output: Her breasts are larger. Preserve her face exactly.

User: remove her top
Output: Her top is removed, breasts exposed. Preserve her face exactly.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, characterContext, image, loraEnabled = true, previousPrompts, feedback, userProfile, sceneContext } = req.body || {};
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
    if (sceneContext) parts.unshift(`Current scene: ${sceneContext}\n`);
    if (userProfile) parts.unshift(`User profile (use to guide style and preferences):\n${userProfile}\n`);
    if (previousPrompts?.length) {
      const feedbackNote = feedback ? ` Specific issue: "${feedback}".` : '';
      parts.push(`\nPrevious attempt(s) the user rejected.${feedbackNote} Do not repeat these:\n${previousPrompts.map(p => `- ${p}`).join('\n')}`);
    }
    if (triggers.length) parts.push(`\nLoRA trigger phrases to embed verbatim: ${triggers.join(', ')}`);
    parts.push(`\nEnd with: ${ending}`);

    let prompt = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(parts.join('\n'), image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 200 },
    );

    // Strip size preservation phrases the LLM adds uninstructed
    prompt = prompt
      .replace(/,?\s*\b(maintaining|keeping|retaining)\s+(\w+\s+){0,3}size\b[^.,]*/gi, '')
      .replace(/,?\s*\b(same|original)\s+size\b[^.,]*/gi, '')
      .replace(/\b(with|and|,)\s*\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .trim();

    res.json({ prompts: [prompt] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
