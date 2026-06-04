require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '20mb' }));

// ── Companion chat app (served from /companion) ────────────────────────────
const companionDist = path.join(__dirname, 'client/dist');
app.use('/companion', express.static(companionDist));
app.get('/companion/*', (_req, res) => {
  res.sendFile(path.join(companionDist, 'index.html'));
});

// Companion API routes
app.post('/api/companion/chat',              require('./api/companion-chat'));
app.post('/api/companion/image',             require('./api/companion-image'));
app.post('/api/companion/conversations',     require('./api/companion-conversations'));
app.get('/api/companion/conversations/:id',  require('./api/companion-conversation'));

// ── WAN Prompt Engine (existing) ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.post('/api/chat',              require('./api/chat'));
app.post('/api/generate',          require('./api/generate'));
app.post('/api/image-prompt',      require('./api/image-prompt'));
app.post('/api/short',             require('./api/short'));
app.post('/api/suggest',           require('./api/suggest'));
app.post('/api/describe',          require('./api/describe'));
app.post('/api/character-suggest', require('./api/character-suggest'));
app.get('/api/memory',             require('./api/memory'));
app.post('/api/memory',            require('./api/memory'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
