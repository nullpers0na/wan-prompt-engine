const { callOpenRouter, TEXT_MODEL } = require('./lib/openrouter');
const { db } = require('./lib/db');

async function fetchContext(character) {
  try {
    const sql = await db();

    const [profileRows, acceptedRows, rejectedRows] = await Promise.all([
      sql`SELECT profile FROM user_profile WHERE id = 1`,
      sql`SELECT prompt_text FROM prompts WHERE accepted = true ORDER BY created_at DESC LIMIT 15`,
      sql`SELECT prompt_text FROM prompts WHERE accepted = false ORDER BY created_at DESC LIMIT 10`,
    ]);

    let charAccepted = [];
    if (character) {
      const rows = await sql`
        SELECT prompt_text FROM prompts
        WHERE character_name = ${character} AND accepted = true
        ORDER BY created_at DESC LIMIT 8
      `;
      charAccepted = rows.map(r => r.prompt_text);
    }

    return {
      profile: profileRows[0]?.profile || null,
      accepted: acceptedRows.map(r => r.prompt_text),
      rejected: rejectedRows.map(r => r.prompt_text),
      charAccepted,
    };
  } catch {
    return { profile: null, accepted: [], rejected: [], charAccepted: [] };
  }
}

function buildContext({ profile, accepted, rejected, charAccepted }, character) {
  const parts = [];
  if (profile) parts.push(`USER PROFILE:\n${profile}`);
  if (charAccepted.length) parts.push(`What has worked for this character:\n${charAccepted.join('\n')}`);
  if (accepted.length) parts.push(`Recently accepted prompts (lean into these patterns):\n${accepted.join('\n')}`);
  if (rejected.length) parts.push(`Rejected prompts (do not suggest anything similar):\n${rejected.join('\n')}`);
  if (!parts.length) return '';
  return `\n\n---\nUSER INTELLIGENCE:\n${parts.join('\n\n')}`;
}

const BASE_PROMPTS = {
  video: `You are a prompt suggester for WAN2.2 video generation. Given a character description, suggest 6 motion or action clip ideas tailored to this specific character.

Analyse her visible attributes and suggest motion that highlights them:
- Large or heavy breasts → jiggle, bounce, slow-motion close-up physics
- Large or prominent ass → ripple, rear jiggle, slow-motion close-up
- Slim or petite body → body sway, walking, subtle motion

Use the user intelligence below to anticipate exactly what they want — follow their patterns, lean into their accepted prompts, and avoid anything resembling rejected ones.

Each suggestion should be one brief sentence. Output one per line, no labels, no numbers.`,

  short: `You are a prompt suggester for WAN2.2 short clip generation. Given a character description, suggest 6 punchy single-motion clip ideas tailored to this specific character.

Use the user intelligence below to predict exactly what they want next — weight suggestions toward their known patterns and accepted prompts.

Keep each suggestion to a few words or one sentence. Output one per line, no labels, no numbers.`,

  image: `You are a smart prompt suggester for Qwen image editing. Given a character description, suggest 6 edit ideas.

Analyse her visible attributes:
- Small or medium breasts → suggest enlarging, adding weight, changing shape
- Visible nipples or areolas → suggest detail, size, or colour changes

Use the user intelligence below to be one step ahead — if their pattern is breasts → areolas → nipple detail, follow that sequence. Actively avoid anything similar to their rejected prompts.

Output one per line, no labels, no numbers.`,
};

const NEXT_STEP_PROMPTS = {
  video: `You are suggesting the next logical motion clip after what the user just prompted.
The user just prompted: "[lastPrompt]"
Suggest 3 natural follow-up prompts (different angle, intensity, or body focus).
WAN2.2 video style — short, action-first. One per line, no labels.`,

  short: `You are suggesting the next logical short clip after what the user just prompted.
The user just prompted: "[lastPrompt]"
Suggest 3 natural follow-ups. Short and punchy. One per line, no labels.`,

  image: `You are suggesting the next logical image edit after what the user just prompted.
The user just prompted: "[lastPrompt]"
Suggest 3 natural follow-up edits. Think like an experienced editor — if they edited breasts, suggest areolas or nipple detail next. One per line, no labels.`,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description, mode = 'video', character, lastPrompt, isNextStep, sessionPrompts } = req.body || {};
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const context = await fetchContext(character);
    const contextBlock = buildContext(context, character);

    let systemPrompt, count;

    if (isNextStep && lastPrompt) {
      const template = NEXT_STEP_PROMPTS[mode] || NEXT_STEP_PROMPTS.image;
      systemPrompt = template.replace('[lastPrompt]', lastPrompt) + contextBlock;
      count = 3;
    } else {
      systemPrompt = (BASE_PROMPTS[mode] || BASE_PROMPTS.video) + contextBlock;
      count = 6;
    }

    if (sessionPrompts?.length) {
      systemPrompt += `\n\nAlready suggested this session (do not repeat):\n${sessionPrompts.map(s => `- ${s.prompt}`).join('\n')}`;
    }

    const userMsg = isNextStep
      ? `Suggest 3 natural follow-up prompts.`
      : `Character: ${description.trim()}\n\nSuggest ${count} prompts tailored to this character and this user's known patterns.`;

    const text = await callOpenRouter(systemPrompt, userMsg, { model: TEXT_MODEL, maxTokens: 400 });

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
