const { callOpenRouter, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPTS = {
  video: `You are a prompt suggester for WAN2.2 video generation. Given a character description, suggest 6 motion or action clip ideas tailored to this specific character.

Analyse her attributes and suggest motion that highlights them:
- Large or heavy breasts → jiggle, bounce, slow-motion close-up physics
- Large or prominent ass → ripple, rear jiggle, slow-motion close-up
- Slim or petite body → body sway, walking, subtle motion
- Any body part explicitly mentioned → suggest motion featuring that part

If breasts seem small or unremarkable, suggest a clip that involves breast physics anyway (jiggle, bounce).
If ass seems small or flat, suggest a rear shot with motion.

Each suggestion should be a brief action/motion scenario (1 sentence). Output one per line, no labels, no numbers.`,

  short: `You are a prompt suggester for WAN2.2 short clip generation. Given a character description, suggest 6 punchy single-motion clip ideas tailored to this specific character.

Analyse her attributes:
- Large or heavy breasts → jiggle, bounce, slow-motion physics
- Large or prominent ass → ripple, jiggle, rear close-up
- Small breasts or ass → suggest clips that would enhance their appearance through motion or angle

Suggestions should be very short (a few words to one sentence). Output one per line, no labels, no numbers.`,

  image: `You are a smart prompt suggester for Qwen image editing. Given a character description, suggest 6 clever edit ideas based on what this character actually looks like.

Analyse her attributes and suggest enhancements that make sense for her:
- Small or medium breasts → suggest making them larger, heavier, fuller
- Small or flat ass → suggest making it bigger, rounder, more prominent
- Suggest edits related to specific body parts mentioned in the description
- Suggest clothing removal, exposure, or outfit changes relevant to her
- Always suggest things that would visually change something specific about her

Be direct about what to change and how. Output one per line, no labels, no numbers.`,

  flux: `You are a smart prompt suggester for Flux Kontext image editing. Given a character description, suggest 6 direct edit ideas tailored to what this character actually looks like.

Analyse her attributes and suggest relevant changes:
- Small or medium breasts → suggest making them larger, heavier, fuller, saggy, perky
- Small or flat ass → suggest making it bigger, rounder, more prominent
- Suggest edits that modify specific body parts mentioned
- Suggest removing clothing or making outfits more revealing
- Keep suggestions short and direct (Flux style)

Output one per line, no labels, no numbers.`,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, mode = 'video' } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.video;
    const text = await callOpenRouter(
      systemPrompt,
      `Character: ${description.trim()}\n\nSuggest 6 prompts tailored to this specific character.`,
      { model: TEXT_MODEL, maxTokens: 400 },
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
