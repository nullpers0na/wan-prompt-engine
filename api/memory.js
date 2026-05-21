const { put, head, del } = require('@vercel/blob');

const BLOB_KEY = 'wan-memory.json';

async function readMemory() {
  try {
    // Try to find the existing blob
    const blob = await head(BLOB_KEY).catch(() => null);
    if (!blob) return createDefaultMemory();
    const res = await fetch(blob.url);
    if (!res.ok) return createDefaultMemory();
    return await res.json();
  } catch {
    return createDefaultMemory();
  }
}

async function writeMemory(data) {
  data.updatedAt = Date.now();
  await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public', // blob URLs are always public but token is needed to write
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

function createDefaultMemory() {
  return {
    preferences: {},      // bodyPart/action frequency counts
    sequences: {},        // what the user asks for after what
    characterHistory: {}, // per-character usage
    recentPrompts: [],    // last 50 prompts
    updatedAt: null,
  };
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

      if (event === 'prompt_generated') {
        const { prompt, mode, character } = data;

        // Track recent prompts
        memory.recentPrompts.unshift({ prompt, mode, character, ts: Date.now() });
        memory.recentPrompts = memory.recentPrompts.slice(0, 50);

        // Extract keywords and update frequency counts
        const keywords = extractKeywords(prompt);
        keywords.forEach(kw => {
          memory.preferences[kw] = (memory.preferences[kw] || 0) + 1;
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
