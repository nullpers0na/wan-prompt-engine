const { db } = require('./lib/db');
const { callOpenRouter, TEXT_MODEL } = require('./lib/openrouter');

const SYNTHESIZE_EVERY = 5;

const BODY_PARTS = ['breasts', 'tits', 'nipples', 'areola', 'areolas', 'ass', 'butt', 'hips', 'thighs', 'legs', 'feet', 'face', 'lips', 'pussy'];
const ACTIONS    = ['bigger', 'larger', 'smaller', 'saggy', 'perky', 'heavy', 'jiggle', 'bounce', 'nude', 'naked', 'cum', 'close-up', 'slow motion', 'spread', 'round', 'curvy'];

function extractTags(prompt) {
  const lower = prompt.toLowerCase();
  return [...new Set([...BODY_PARTS, ...ACTIONS].filter(kw => lower.includes(kw)))];
}

async function synthesizeProfile(sql, promptCount) {
  if (promptCount % SYNTHESIZE_EVERY !== 0) return;

  const [recent, accepted, rejected] = await Promise.all([
    sql`SELECT prompt_text, mode, character_name FROM prompts ORDER BY created_at DESC LIMIT 40`,
    sql`SELECT prompt_text, character_name FROM prompts WHERE accepted = true ORDER BY created_at DESC LIMIT 20`,
    sql`SELECT prompt_text FROM prompts WHERE accepted = false ORDER BY created_at DESC LIMIT 15`,
  ]);

  if (recent.length < 3) return;

  const chars = [...new Set(recent.map(r => r.character_name).filter(Boolean))];

  const profile = await callOpenRouter(
    'You are building a behavioral profile for an adult AI image/video generation user. Be specific, direct, and descriptive — this profile is injected into AI prompts to personalise suggestions.',
    `Recent prompts (newest first):\n${recent.map(r => r.prompt_text).join('\n')}\n\nAccepted/copied prompts:\n${accepted.map(r => r.prompt_text).join('\n') || 'none yet'}\n\nRejected/regenerated prompts:\n${rejected.map(r => r.prompt_text).join('\n') || 'none yet'}\n\nCharacters used: ${chars.join(', ') || 'none identified'}\n\nWrite a 3-5 sentence profile. Cover: what content and body parts they obsess over, their typical workflow sequences (what follows what), what they consistently reject, and any character-specific patterns. Be blunt and specific.`,
    { model: TEXT_MODEL, maxTokens: 300 },
  ).catch(() => null);

  if (!profile) return;

  await sql`
    INSERT INTO user_profile (id, profile, prompt_count, updated_at)
    VALUES (1, ${profile}, ${promptCount}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      profile = ${profile},
      prompt_count = ${promptCount},
      updated_at = NOW()
  `;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const sql = await db();
      const [profileRows, recentRows, charRows] = await Promise.all([
        sql`SELECT profile, prompt_count, updated_at FROM user_profile WHERE id = 1`,
        sql`SELECT prompt_text, mode, character_name, accepted, created_at FROM prompts ORDER BY created_at DESC LIMIT 20`,
        sql`SELECT name, description, prompt_count FROM characters ORDER BY prompt_count DESC LIMIT 20`,
      ]);
      return res.json({
        profile: profileRows[0]?.profile || null,
        promptCount: profileRows[0]?.prompt_count || 0,
        updatedAt: profileRows[0]?.updated_at || null,
        recentPrompts: recentRows,
        characters: charRows,
      });
    } catch (err) {
      console.error('memory GET error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const sql = await db();
      const { event, data } = req.body || {};

      if (event === 'prompt_generated') {
        const { prompt, mode, character } = data;
        const tags = extractTags(prompt);

        await sql`
          INSERT INTO prompts (prompt_text, mode, character_name, tags)
          VALUES (${prompt}, ${mode || null}, ${character || null}, ${tags})
        `;

        if (character) {
          await sql`
            INSERT INTO characters (name, prompt_count, updated_at)
            VALUES (${character}, 1, NOW())
            ON CONFLICT (name) DO UPDATE SET
              prompt_count = characters.prompt_count + 1,
              updated_at = NOW()
          `;
        }

        const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM prompts`;
        await synthesizeProfile(sql, count);

        return res.json({ ok: true });
      }

      if (event === 'prompt_accepted') {
        const { prompt } = data;
        await sql`
          UPDATE prompts SET accepted = true
          WHERE id = (
            SELECT id FROM prompts WHERE prompt_text = ${prompt}
            ORDER BY created_at DESC LIMIT 1
          )
        `;
        return res.json({ ok: true });
      }

      if (event === 'prompt_rejected') {
        const { prompt } = data;
        await sql`
          UPDATE prompts SET accepted = false
          WHERE id = (
            SELECT id FROM prompts WHERE prompt_text = ${prompt}
            ORDER BY created_at DESC LIMIT 1
          )
        `;
        return res.json({ ok: true });
      }

      if (event === 'character_named') {
        const { name, description } = data;
        await sql`
          INSERT INTO characters (name, description, updated_at)
          VALUES (${name}, ${description || null}, NOW())
          ON CONFLICT (name) DO UPDATE SET
            description = ${description || null},
            updated_at = NOW()
        `;
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown event' });
    } catch (err) {
      console.error('memory POST error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
