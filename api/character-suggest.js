const { callOpenRouter, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a character name lookup. The user is typing a character name — return only characters whose name literally contains the query string.

Output: up to 5 results, one per line, format: "Name, Source"
Example for query "tifa": Tifa Lockhart, Final Fantasy VII
Example for query "2b": 2B, NieR: Automata

Rules:
- ONLY return characters whose name contains the query (case-insensitive)
- If no character names contain the query, output nothing at all
- No preamble, no explanation, no filler — just the list`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { query } = req.body || {};
    if (!query?.trim() || query.trim().length < 3) return res.json({ suggestions: [] });

    const text = await callOpenRouter(
      SYSTEM_PROMPT,
      `Query: ${query.trim()}`,
      { model: TEXT_MODEL, maxTokens: 120 },
    );

    const suggestions = text
      .split('\n')
      .map(l => l.replace(/^[\s\-*]+/, '').trim())
      .filter(l => l.length > 1)
      .slice(0, 5);

    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.json({ suggestions: [] }); // fail silently — autocomplete is non-critical
  }
};
