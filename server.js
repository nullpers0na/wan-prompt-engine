require('dotenv').config();
const express = require('express');
const path = require('path');
const generateHandler = require('./api/generate');
const whatsappRoutes = require('./routes/whatsapp');
const { getClient } = require('./lib/whatsapp-client');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/generate', generateHandler);
app.use('/api/whatsapp', whatsappRoutes);

// Initialise WhatsApp client on startup (non-fatal if it fails)
try {
  getClient();
} catch (err) {
  console.error('[WhatsApp] Failed to start client:', err.message);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
