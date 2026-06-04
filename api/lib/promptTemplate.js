/**
 * Wraps a raw image description from the chat model into the operator's
 * preferred image-gen prompt format. Edit this function to inject style
 * tokens, quality tags, LoRA triggers, etc.
 */
function promptTemplate(description) {
  const prefix = process.env.IMAGE_PROMPT_PREFIX || '';
  const suffix = process.env.IMAGE_PROMPT_SUFFIX || '';
  const base = description.trim();
  return [prefix, base, suffix].filter(Boolean).join(', ');
}

module.exports = { promptTemplate };
