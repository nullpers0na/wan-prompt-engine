// "elena fisher, uncharted" → "Elena"
function firstName(name) {
  if (!name) return '';
  return name.split(/[,\s]/)[0].replace(/^\w/, c => c.toUpperCase());
}

// Builds a concise natural-language summary of the user's memory bank
// to inject into AI system prompts
function buildMemoryContext(memory, character) {
  if (!memory) return '';

  const lines = [];

  // Top overall preferences
  const topPrefs = Object.entries(memory.preferences || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);
  if (topPrefs.length) {
    lines.push(`User's most common focus areas: ${topPrefs.join(', ')}.`);
  }

  // Common sequences
  const seqLines = [];
  Object.entries(memory.sequences || {}).forEach(([after, nexts]) => {
    const top = Object.entries(nexts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) seqLines.push(`after "${after}" they usually ask for "${top[0]}"`);
  });
  if (seqLines.length) {
    lines.push(`Known sequences: ${seqLines.slice(0, 4).join('; ')}.`);
  }

  // Per-character preferences
  if (character && memory.characterHistory?.[character]) {
    const charPrefs = Object.entries(memory.characterHistory[character].preferences || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
    if (charPrefs.length) {
      lines.push(`For ${firstName(character)} specifically, they focus on: ${charPrefs.join(', ')}.`);
    }
  }

  // Last 3 prompts for context
  const recent = (memory.recentPrompts || []).slice(0, 3).map(p => p.prompt);
  if (recent.length) {
    lines.push(`Recent prompts: "${recent.join('" / "')}".`);
  }

  if (!lines.length) return '';
  return `\n\nUSER MEMORY (use this to personalise your suggestions — anticipate what they want next based on their patterns):\n${lines.join('\n')}`;
}

module.exports = { buildMemoryContext };
