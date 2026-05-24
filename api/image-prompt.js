const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const LORA_TRIGGERS = [
  'tiny breasts', 'small breasts', 'medium breasts', 'large breasts',
  'tiny areoles', 'small areoles', 'medium areoles', 'large areoles', 'medium sized areoles',
  'pale areoles', 'ghost areoles', 'brown areoles', 'dark areoles',
  'hard nipples', 'erect nipples',
];

// Code-detected enhancements appended verbatim to the LLM output (bypasses LLM reformulation)
const PHRASE_ENHANCEMENTS = [
  {
    detect: /\b(saggy|droopy|hanging|pendulous)\b/i,
    append: 'naturally saggy breasts, hanging low, nipples pointing downward.',
  },
];

// Phrases the LLM adds on its own that we never want in output
const STRIP_PHRASES = [
  /,?\s*subtle skin folds where (the )?breasts? meet (the )?chest/gi,
  /,?\s*natural skin texture/gi,
  /,?\s*skin folds?[^,.]*/gi,
];

const SYSTEM_PROMPT = `You are a Qwen image edit prompt writer. Convert the edit request into 2-4 clear instructional sentences.

Qwen uses a language model as its text encoder — it responds to clear instructions, not comma-separated keyword lists.

Rules:
- Write as direct instructions: "Make...", "Change...", "Transform...", "Add...", "Keep..."
- Preserve the user's exact adjectives and intent — never soften, substitute, or change the meaning
- Do not add physical detail descriptors the user did not mention (no skin texture, skin folds, weight descriptions, etc.)
- If LoRA trigger phrases are provided, embed them verbatim within a sentence
- If additional instructions are provided, incorporate them naturally
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

    // Detect LoRA triggers
    const triggers = loraEnabled
      ? LORA_TRIGGERS.filter(t => baseLower.includes(t))
      : [];

    // Detect phrase enhancements — collected for direct append, not LLM input
    const appendPhrases = [];
    for (const { detect, append } of PHRASE_ENHANCEMENTS) {
      if (detect.test(normalized)) appendPhrases.push(append);
    }

    // Build LLM user message
    const parts = [`Edit request: ${normalized}`];
    if (characterContext) parts.unshift(`Character context: ${characterContext}\n`);
    if (triggers.length) parts.push(`\nLoRA trigger phrases to embed verbatim: ${triggers.join(', ')}`);
    if (isMultiImage) parts.push(`\nEnd with: Keep the exact style, rendering, lighting and aesthetic of <image_1> unchanged.`);
    else parts.push(`\nEnd with: Preserve the original face exactly.`);

    let prompt = await callOpenRouter(
      SYSTEM_PROMPT,
      buildUserContent(parts.join('\n'), image),
      { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 200 },
    );
    // Strip phrases the LLM adds uninstructed
    for (const re of STRIP_PHRASES) prompt = prompt.replace(re, '');
    prompt = prompt.trim();

    // Append phrase enhancements verbatim after LLM output
    if (appendPhrases.length) {
      prompt = `${prompt} ${appendPhrases.join(' ')}`;
    }

    res.json({ prompts: [prompt] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
