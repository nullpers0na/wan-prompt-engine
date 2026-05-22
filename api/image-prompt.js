const { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL } = require('./lib/openrouter');

const LORA_TRIGGERS = [
  'tiny breasts', 'small breasts', 'medium breasts', 'large breasts',
  'tiny areoles', 'small areoles', 'medium areoles', 'large areoles', 'medium sized areoles',
  'pale areoles', 'ghost areoles', 'brown areoles', 'dark areoles',
  'hard nipples', 'erect nipples',
];

const SYSTEM_PROMPT = `You are a LoRA trigger selector. Given an image edit request, output only the LoRA trigger words from the list below that directly apply.

Available triggers:
${LORA_TRIGGERS.map(t => `- "${t}"`).join('\n')}

Rules:
- Output only triggers from the list above, comma-separated
- Only include a trigger if the edit request explicitly mentions that feature
- Do NOT add areola/nipple triggers if the user only mentioned breast shape
- If no triggers apply, output the single word: none`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, characterContext, image, loraEnabled = true } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    // Replace "image 2" / "image 1" with <image_2> / <image_1> syntax
    const normalized = description.trim()
      .replace(/\bimage\s+2\b/gi, '<image_2>')
      .replace(/\bimage\s+1\b/gi, '<image_1>')
      .replace(/[.!]+$/, '');

    const isMultiImage = normalized.includes('<image_2>') || normalized.includes('<image_1>');
    const base = normalized;
    const parts = [base];

    if (loraEnabled) {
      const llmInput = characterContext
        ? `Character context: ${characterContext}\n\nEdit request: ${description}`
        : description;

      const raw = await callOpenRouter(
        SYSTEM_PROMPT,
        buildUserContent(llmInput, image),
        { model: image ? VISION_MODEL : TEXT_MODEL, maxTokens: 80 },
      );

      // Extract only known triggers — ignore anything else the LLM outputs
      const baseLower = base.toLowerCase();
      const triggers = LORA_TRIGGERS.filter(t =>
        raw.toLowerCase().includes(t) && !baseLower.includes(t)
      );
      if (triggers.length) parts.push(triggers.join(', '));
    }

    if (isMultiImage) {
      parts.push('keep the exact style, rendering, lighting and aesthetic of <image_1> unchanged');
    } else {
      parts.push('preserve the original face exactly');
    }

    res.json({ prompts: [parts.join(', ')] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
