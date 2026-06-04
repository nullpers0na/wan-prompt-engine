const { getDb } = require('./lib/companionDb');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const db = getDb();
    const id = randomUUID();
    const now = Date.now();
    const title = (req.body?.title || 'New conversation').slice(0, 120);
    db.prepare(`INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?,?,?,?)`)
      .run(id, title, now, now);
    return res.status(201).json({ id, title, created_at: now, updated_at: now });
  }
  res.status(405).json({ error: 'Method not allowed' });
};
