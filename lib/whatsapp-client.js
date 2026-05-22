const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { db } = require('../api/lib/db');

let client = null;
let qrDataUrl = null;
let isReady = false;

function getClient() {
  if (client) return client;

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    },
  });

  client.on('qr', async (qr) => {
    qrDataUrl = await qrcode.toDataURL(qr);
    isReady = false;
    console.log('[WhatsApp] QR code ready — scan to connect');
  });

  client.on('authenticated', () => {
    qrDataUrl = null;
    console.log('[WhatsApp] Authenticated');
  });

  client.on('ready', () => {
    isReady = true;
    qrDataUrl = null;
    console.log('[WhatsApp] Client ready');
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    qrDataUrl = null;
    client = null;
    console.log('[WhatsApp] Disconnected:', reason);
  });

  client.on('message', async (msg) => {
    if (msg.fromMe) return;
    try {
      const contact = await msg.getContact();
      const sql = await db();
      await sql`
        INSERT INTO whatsapp_messages (wa_id, from_number, contact_name, body, timestamp)
        VALUES (
          ${msg.id._serialized},
          ${msg.from},
          ${contact.pushname || contact.name || msg.from},
          ${msg.body},
          ${msg.timestamp}
        )
        ON CONFLICT (wa_id) DO NOTHING
      `;
    } catch (err) {
      console.error('[WhatsApp] Failed to store message:', err.message);
    }
  });

  client.initialize().catch((err) => {
    console.error('[WhatsApp] Init error:', err.message);
    client = null;
  });

  return client;
}

function getStatus() {
  return { ready: isReady, qr: qrDataUrl };
}

async function sendWhatsAppMessage(to, body) {
  if (!isReady || !client) throw new Error('WhatsApp client not ready');
  await client.sendMessage(to, body);
}

module.exports = { getClient, getStatus, sendWhatsAppMessage };
