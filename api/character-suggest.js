const { callOpenRouter, TEXT_MODEL } = require('./lib/openrouter');

const SYSTEM_PROMPT = `You are a character name lookup for games, anime, and fiction. Given a partial name or query, suggest matching characters.

Output: up to 5 results, one per line, format: "Name, Source"
Examples:
Tifa Lockhart, Final Fantasy VII
2B, NieR: Automata

Rules:
- Only output the list, no preamble
- If nothing matches, output nothing
- Prioritise exact prefix matches first, then contains matches`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { query } = req.body || {};
    if (!query?.trim() || query.trim().length < 2) return res.json({ suggestions: [] });

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
