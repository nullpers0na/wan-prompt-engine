require('dotenv').config();
const express = require('express');
const path = require('path');
const generateHandler = require('./api/generate');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.post('/api/generate', generateHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
