const postgres = require('postgres');

let _sql = null;
let _ready = false;

function getSql() {
  if (!_sql) {
    _sql = postgres(process.env.POSTGRES_URL, {
      max: 1,
      ssl: { rejectUnauthorized: false },
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return _sql;
}

async function db() {
  const sql = getSql();
  if (!_ready) {
    await sql`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY DEFAULT 1,
        profile TEXT,
        prompt_count INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS characters (
        name TEXT PRIMARY KEY,
        description TEXT,
        prompt_count INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS prompts (
        id SERIAL PRIMARY KEY,
        prompt_text TEXT NOT NULL,
        mode TEXT,
        character_name TEXT,
        accepted BOOLEAN,
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id SERIAL PRIMARY KEY,
        wa_id TEXT UNIQUE NOT NULL,
        from_number TEXT NOT NULL,
        contact_name TEXT,
        body TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        status TEXT DEFAULT 'pending',
        draft_response TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    _ready = true;
  }
  return sql;
}

module.exports = { db };
