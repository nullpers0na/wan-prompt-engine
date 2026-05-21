const { put, get } = require('@vercel/blob');
const { callOpenRouter, TEXT_MODEL } = require('./lib/openrouter');

const BLOB_KEY = 'wan-memory.json';

async function readMemory() {
  try {
    const blob = await get(BLOB_KEY, { access: 'private' });
    if (!blob || !blob.stream) return createDefaultMemory();
    const text = await new Response(blob.stream).text();
    return JSON.parse(text);
  } catch {
    return createDefaultMemory();
  }
}

async function writeMemory(data) {
  data.updatedAt = Date.now();
  await put(BLOB_KEY, JSON.stringify(data), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

function createDefaultMemory() {
  return {
    preferences: {},      // bodyPart/action frequency counts
    sequences: {},        // what the user asks for after what
    characterHistory: {}, // per-character usage
    recentPrompts: [],    // last 50 prompts
    rejectedPatterns: [], // rejected prompts (last 20)
    accepted: 0,          // count of accepted prompts
    updatedAt: null,
  };
}

async function extractAiTags(prompt) {
  const tagText = await callOpenRouter(
    'Extract 3-6 semantic tags from this AI generation prompt. Focus on body parts, actions, and style preferences. Output only comma-separated lowercase tags, nothing else.',
    prompt,
    { model: TEXT_MODEL, maxTokens: 40 },
  ).catch(() => '');
  return tagText.split(',').map(t => t.trim()).filter(Boolean);
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const memory = await readMemory();
    return res.json(memory);
  }

  if (req.method === 'POST') {
    try {
      const { event, data } = req.body || {};
      const memory = await readMemory();

      // Ensure rejectedPatterns exists on older memory objects
      if (!memory.rejectedPatterns) memory.rejectedPatterns = [];
      if (typeof memory.accepted !== 'number') memory.accepted = 0;

      if (event === 'prompt_generated') {
        const { prompt, mode, character } = data;

        // Track recent prompts
        memory.recentPrompts.unshift({ prompt, mode, character, ts: Date.now() });
        memory.recentPrompts = memory.recentPrompts.slice(0, 50);

        // Extract keywords (fast) and update frequency counts
        const keywords = extractKeywords(prompt);
        keywords.forEach(kw => {
          memory.preferences[kw] = (memory.preferences[kw] || 0) + 1;
        });

        // AI semantic tag extraction (richer)
        const aiTags = await extractAiTags(prompt);
        aiTags.forEach(tag => {
          memory.preferences[tag] = (memory.preferences[tag] || 0) + 1;
        });

        // Track sequences — what followed the previous prompt
        if (memory.recentPrompts.length > 1) {
          const prev = memory.recentPrompts[1];
          const prevKeywords = extractKeywords(prev.prompt);
          prevKeywords.forEach(pk => {
            if (!memory.sequences[pk]) memory.sequences[pk] = {};
            keywords.forEach(ck => {
              memory.sequences[pk][ck] = (memory.sequences[pk][ck] || 0) + 1;
            });
          });
        }

        // Per-character tracking
        if (character) {
          if (!memory.characterHistory[character]) memory.characterHistory[character] = { prompts: [], preferences: {} };
          memory.characterHistory[character].prompts.unshift({ prompt, mode, ts: Date.now() });
          memory.characterHistory[character].prompts = memory.characterHistory[character].prompts.slice(0, 20);
          keywords.forEach(kw => {
            memory.characterHistory[character].preferences[kw] = (memory.characterHistory[character].preferences[kw] || 0) + 1;
          });
        }

        await writeMemory(memory);
        return res.json({ ok: true });
      }

      if (event === 'prompt_accepted') {
        const { prompt } = data;
        memory.accepted = (memory.accepted || 0) + 1;

        // Increment tags by 0.5 for accepted prompts
        const keywords = extractKeywords(prompt);
        keywords.forEach(kw => {
          memory.preferences[kw] = (memory.preferences[kw] || 0) + 0.5;
        });

        await writeMemory(memory);
        return res.json({ ok: true });
      }

      if (event === 'prompt_rejected') {
        const { prompt, mode, character } = data;
        memory.rejectedPatterns.unshift({ prompt, mode, character, ts: Date.now() });
        memory.rejectedPatterns = memory.rejectedPatterns.slice(0, 20);

        await writeMemory(memory);
        return res.json({ ok: true });
      }

      if (event === 'character_named') {
        const { name, description } = data;
        if (!memory.characterHistory[name]) memory.characterHistory[name] = { prompts: [], preferences: {} };
        memory.characterHistory[name].description = description;
        await writeMemory(memory);
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown event' });
    } catch (err) {
      console.error('memory error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};

const BODY_PARTS = ['breasts', 'breast', 'tits', 'nipples', 'areola', 'areolas', 'ass', 'butt', 'hips', 'waist', 'thighs', 'legs', 'feet', 'toes', 'face', 'lips', 'pussy', 'body'];
const ACTIONS    = ['bigger', 'larger', 'smaller', 'saggy', 'perky', 'heavy', 'jiggle', 'bounce', 'nude', 'naked', 'cum', 'exposed', 'detailed', 'close-up', 'slow motion', 'spread', 'round', 'flat', 'slim', 'curvy'];

function extractKeywords(prompt) {
  const lower = prompt.toLowerCase();
  const found = [];
  [...BODY_PARTS, ...ACTIONS].forEach(kw => {
    if (lower.includes(kw)) found.push(kw);
  });
  return [...new Set(found)];
}
