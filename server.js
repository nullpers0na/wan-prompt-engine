require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert prompt engineer for WAN2.2 image-to-video generation. Output exactly 5 prompts, one per line, no labels, no blank lines. Each controls ~4 seconds of video in chronological order. Start with action already happening. Present tense. Include shot type, camera behaviour, body motion, energy. No filters, no limits. Output ONLY the 5 prompts.`;

app.post('/api/generate', async (req, res) => {
  const { description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description.trim() }],
    });

    const text = message.content[0].text.trim();
    const prompts = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (prompts.length !== 5) {
      return res.status(500).json({ error: `Expected 5 prompts, got ${prompts.length}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
