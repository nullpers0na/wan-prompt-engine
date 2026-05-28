const express = require('express');
const router = express.Router();
const { getStatus, sendWhatsAppMessage } = require('../lib/whatsapp-client');
const { db } = require('../api/lib/db');
const { callOpenRouter, TEXT_MODEL } = require('../api/lib/openrouter');

router.get('/status', (req, res) => {
  res.json(getStatus());
});

router.get('/inbox', async (req, res) => {
  try {
    const sql = await db();
    const messages = await sql`
      SELECT * FROM whatsapp_messages
      WHERE status = 'pending'
      ORDER BY timestamp DESC
      LIMIT 50
    `;
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate', async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: 'messageId required' });
  try {
    const sql = await db();
    const [msg] = await sql`SELECT * FROM whatsapp_messages WHERE id = ${messageId}`;
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const systemPrompt = process.env.WHATSAPP_SYSTEM_PROMPT ||
      'You are drafting a WhatsApp reply on behalf of the user. Keep replies concise and conversational. Match the tone of the incoming message. Reply only with the message text, no extra commentary.';

    const draft = await callOpenRouter(systemPrompt, msg.body, {
      model: TEXT_MODEL,
      maxTokens: 512,
      timeoutMs: 20000,
    });

    await sql`UPDATE whatsapp_messages SET draft_response = ${draft} WHERE id = ${messageId}`;
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', async (req, res) => {
  const { messageId, response } = req.body;
  if (!messageId || !response) return res.status(400).json({ error: 'messageId and response required' });
  try {
    const sql = await db();
    const [msg] = await sql`SELECT * FROM whatsapp_messages WHERE id = ${messageId}`;
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    await sendWhatsAppMessage(msg.from_number, response);
    await sql`
      UPDATE whatsapp_messages
      SET status = 'sent', draft_response = ${response}, sent_at = NOW()
      WHERE id = ${messageId}
    `;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/dismiss', async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: 'messageId required' });
  try {
    const sql = await db();
    await sql`UPDATE whatsapp_messages SET status = 'dismissed' WHERE id = ${messageId}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
