const VISION_MODEL = 'qwen/qwen2.5-vl-72b-instruct';
const TEXT_MODEL   = 'mistralai/mistral-nemo';

function buildUserContent(description, image) {
  if (!image) return description.trim();
  return [
    { type: 'text', text: `Focus on this description only: ${description.trim()}` },
    { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
  ];
}

async function callOpenRouter(systemPrompt, userContent, { model, maxTokens = 1024 } = {}) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

module.exports = { callOpenRouter, buildUserContent, VISION_MODEL, TEXT_MODEL };
