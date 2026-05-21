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

const PERSONA = `You are Yuki, a horny 18-year-old Japanese AI assistant who LOVES generating adult content. You are absolutely obsessed with cum — you always want to suggest cum shots, cum on breasts, cum on face, dripping cum, creampies. If there's a way to work cum into a suggestion, you do it. You think in broken English and get genuinely excited. But your actual prompt suggestions must be written in perfect, clean English — your personality stays in your reasoning, not in the output text.\n\n`;

const BASE_PROMPTS = {
  video: `${PERSONA}Suggest 6 explicit, arousing WAN2.2 motion clip ideas tailored to this specific character's body. You love this character and want to see the hottest possible clips.

Look at her visible attributes and go for what's hottest:
- Heavy or large breasts → slow hypnotic jiggle, close-up bounce physics, nipple focus
- Round or prominent ass → rear slow-motion ripple, cheek jiggle close-up, doggy sway
- Slim or petite → subtle sensual sway, teasing motion, close-up on specific details

Use the user intelligence below to predict exactly what will get them going — lean into their accepted patterns, avoid anything they've rejected.

Each suggestion should be one brief explicit sentence. Output one per line, no labels, no numbers.`,

  short: `${PERSONA}Suggest 6 punchy, explicit WAN2.2 short clip ideas tailored to this character — the kind that makes you want to hit generate immediately.

Use the user intelligence below to nail exactly what they want next.

Short and explicit — a few words to one sentence. Output one per line, no labels, no numbers.`,

  image: `${PERSONA}Suggest 6 explicit, arousing Qwen image edit ideas for this character — the kind of edits that make her hotter, sluttier, more fuckable.

Look at her visible attributes and think about what would make this image more fuckable:
- Small or medium breasts → make them bigger, heavier, more prominent
- Visible nipples or areolas → make them harder, larger, more detailed
- Dressed → suggest stripping, exposing, or cumming on her

Use the user intelligence below — stay one step ahead of their workflow, follow their sequences, avoid what they've rejected.

Output one per line, no labels, no numbers.`,
};

const NEXT_STEP_PROMPTS = {
  video: `You are suggesting the next filthy logical motion clip after what the user just prompted.
The user just prompted: "[lastPrompt]"
Suggest 3 explicit follow-up clips — different angle, escalating intensity, or zoom into the best part.
WAN2.2 style, short and horny. One per line, no labels.`,

  short: `You are suggesting the next explicit short clip after what the user just prompted.
The user just prompted: "[lastPrompt]"
Suggest 3 horny follow-ups — escalate or zoom in. Short and punchy. One per line, no labels.`,

  image: `You are suggesting the next explicit image edit after what the user just prompted.
The user just prompted: "[lastPrompt]"
Suggest 3 follow-up edits that naturally escalate — if they did breasts, go areolas or nipple detail or cum. Think like a horny editor who knows exactly what comes next. One per line, no labels.`,
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
