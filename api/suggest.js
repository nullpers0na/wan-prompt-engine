const { callOpenRouter, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPTS = {
  video: `You are a prompt suggester for WAN2.2 video generation. Given a character description, suggest 6 short scene descriptions a user might want to generate. Each should be a brief action/motion scenario (1 sentence). Output one per line, no labels, no numbers.`,
  short: `You are a prompt suggester for WAN2.2 short clip generation. Given a character description, suggest 6 punchy single-motion clip ideas. Each should be very short (a few words to one sentence). Output one per line, no labels, no numbers.`,
  image: `You are a prompt suggester for Qwen image editing. Given a character description, suggest 6 image edit ideas relevant to this specific character. Each should be a short edit instruction. Output one per line, no labels, no numbers.`,
  flux: `You are a prompt suggester for Flux Kontext image editing. Given a character description, suggest 6 direct edit ideas relevant to this specific character. Each should be a short, direct instruction. Output one per line, no labels, no numbers.`,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, mode = 'video' } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.video;
    const text = await callOpenRouter(
      systemPrompt,
      `Character: ${description.trim()}\n\nSuggest 6 prompts for this character.`,
      { model: TEXT_MODEL, maxTokens: 300 },
    );

    const suggestions = text
      .split('\n')
      .map(l => l.replace(/^[\s*#\-\d.)\]]+/, '').trim())
      .filter(l => l.length > 5)
      .slice(0, 6);

    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
