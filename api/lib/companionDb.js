const postgres = require('postgres');

let _sql = null;
let _ready = false;

function getSql() {
  if (_sql) return _sql;
  _sql = postgres(process.env.POSTGRES_URL, {
    max: 3,
    ssl: { rejectUnauthorized: false },
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return _sql;
}

async function getDb() {
  const sql = getSql();
  if (!_ready) {
    await sql`
      CREATE TABLE IF NOT EXISTS companion_conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS companion_messages (
        id SERIAL PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES companion_conversations(id),
        role TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        content TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_companion_messages_conv
      ON companion_messages(conversation_id, id)
    `;
    _ready = true;
  }
  return sql;
}

module.exports = { getDb };
