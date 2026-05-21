const { callOpenRouter, TEXT_MODEL } = require('./lib/openrouter');
const { buildMemoryContext } = require('./lib/memory-context');
const { list } = require('@vercel/blob');

async function fetchMemory() {
  try {
    const { blobs } = await list({ prefix: 'wan-memory.json', limit: 1 });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url);
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

const BASE_PROMPTS = {
  video: `You are a prompt suggester for WAN2.2 video generation. Given a character description, suggest 6 motion or action clip ideas tailored to this specific character.

Analyse her attributes and suggest motion that highlights them:
- Large or heavy breasts → jiggle, bounce, slow-motion close-up physics
- Large or prominent ass → ripple, rear jiggle, slow-motion close-up
- Slim or petite body → body sway, walking, subtle motion

If the user memory is provided, prioritise suggestions that follow their known patterns and sequences — anticipate the next logical step in their workflow.

Each suggestion should be a brief action/motion scenario (1 sentence). Output one per line, no labels, no numbers.`,

  short: `You are a prompt suggester for WAN2.2 short clip generation. Given a character description, suggest 6 punchy single-motion clip ideas tailored to this specific character.

If the user memory is provided, use their patterns to predict what they want next — weight suggestions toward their most common focus areas and known sequences.

Suggestions should be very short (a few words to one sentence). Output one per line, no labels, no numbers.`,

  image: `You are a smart prompt suggester for Qwen image editing. Given a character description, suggest 6 clever edit ideas.

Analyse her attributes:
- Small or medium breasts → suggest making them larger, heavier, fuller
- Small or flat ass → suggest making it bigger, rounder, more prominent

If the user memory is provided: use their sequences to predict what they want next. If their last prompt was about breasts, suggest the logical follow-up (areolas, nipples, weight, sag). Be one step ahead.

Be direct about what to change. Output one per line, no labels, no numbers.`,
};

const NEXT_STEP_PROMPTS = {
  video: `You are suggesting the next logical edit/motion after what the user just asked for.
The user just prompted: "[lastPrompt]"
Based on this, suggest 3 follow-up prompts that would naturally come next.
For video mode: if they asked for jiggle → suggest slow-motion close-up, rear shot, different angle.
Keep each suggestion short and in WAN video style.
Output one per line, no labels, no numbers.`,

  short: `You are suggesting the next logical short clip after what the user just asked for.
The user just prompted: "[lastPrompt]"
Based on this, suggest 3 follow-up prompts that would naturally come next.
Keep each suggestion short and punchy (WAN short clip style).
Output one per line, no labels, no numbers.`,

  image: `You are suggesting the next logical edit after what the user just asked for.
The user just prompted: "[lastPrompt]"
Based on this, suggest 3 follow-up prompts that would naturally come next.
For image mode: if they asked for bigger breasts → suggest areolas, nipple detail, weight/sag. If saggy → suggest nipple detail, areola size. Think like an experienced editor.
Keep each suggestion short and in Qwen image edit style.
Output one per line, no labels, no numbers.`,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, mode = 'video', character, lastPrompt, isNextStep, sessionPrompts } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const memory = await fetchMemory();
    const memoryContext = buildMemoryContext(memory, character);

    let systemPrompt;
    let count;

    if (isNextStep && lastPrompt) {
      const template = NEXT_STEP_PROMPTS[mode] || NEXT_STEP_PROMPTS.image;
      systemPrompt = template.replace('[lastPrompt]', lastPrompt);
      count = 3;
    } else {
      systemPrompt = (BASE_PROMPTS[mode] || BASE_PROMPTS.video) + memoryContext;
      count = 6;
    }

    // Append session context to avoid repetition
    if (sessionPrompts && sessionPrompts.length > 0) {
      const sessionList = sessionPrompts.map(s => `- ${s.prompt}`).join('\n');
      systemPrompt += `\n\nSession so far (don't repeat these):\n${sessionList}`;
    }

    const userMsg = isNextStep
      ? `Suggest 3 natural follow-up prompts.`
      : `Character: ${description.trim()}\n\nSuggest ${count} prompts tailored to this specific character and this user's patterns.`;

    const text = await callOpenRouter(
      systemPrompt,
      userMsg,
      { model: TEXT_MODEL, maxTokens: 400 },
    );

    const suggestions = text
      .split('\n')
      .map(l => l.replace(/^[\s*#\-\d.)\]]+/, '').trim())
      .filter(l => l.length > 5)
      .slice(0, count);

    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
