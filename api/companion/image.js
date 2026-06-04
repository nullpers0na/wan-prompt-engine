const { getDb } = require('../lib/companionDb');
const { generateImage } = require('../lib/comfyClient');
const { promptTemplate } = require('../lib/promptTemplate');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conversationId, prompt } = req.body || {};
  if (!conversationId || !prompt) {
    return res.status(400).json({ error: 'conversationId and prompt required' });
  }

  const sql = await getDb();
  const [conv] = await sql`
    SELECT id FROM companion_conversations WHERE id = ${conversationId}
  `;
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const finalPrompt = promptTemplate(prompt);

  try {
    const { base64, mimeType } = await generateImage(finalPrompt);
    const now = Date.now();
    await sql`
      INSERT INTO companion_messages (conversation_id, role, type, content, created_at)
      VALUES (${conversationId}, 'assistant', 'image',
              ${JSON.stringify({ base64, mimeType, prompt: finalPrompt })}, ${now})
    `;
    await sql`
      UPDATE companion_conversations SET updated_at = ${now} WHERE id = ${conversationId}
    `;
    return res.json({ base64, mimeType, prompt: finalPrompt });
  } catch (err) {
    console.error('image gen error:', err.message);
    return res.status(500).json({ error: err.message || 'Image generation failed' });
  }
};
