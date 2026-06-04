const { getDb } = require('../../lib/companionDb');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  const sql = await getDb();
  const [conv] = await sql`
    SELECT * FROM companion_conversations WHERE id = ${id}
  `;
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await sql`
    SELECT * FROM companion_messages
    WHERE conversation_id = ${id}
    ORDER BY id ASC
  `;

  res.json({ ...conv, messages });
};
