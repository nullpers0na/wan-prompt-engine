require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '20mb' }));
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
