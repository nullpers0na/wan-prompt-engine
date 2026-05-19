const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert prompt engineer specialising in NSFW AI image generation and editing (Qwen, FLUX, SDXL). Your job is to write 3 prompt variations for editing or enhancing a source image.

KEY IMAGE EDITING RULES:
- Images are STATIC — focus on composition, pose, lighting, detail, and finish
- Do NOT use motion language (jiggle, bounce, sway) — that belongs in video prompts
- Pose language: legs spread, back arched, bent over, kneeling, seductive pose, presenting, submissive pose, on all fours, looking over shoulder, facing camera, eye contact
- Body detail: skin texture, smooth skin, detailed nipples, areola detail, body proportions, curves, shaved, natural
- Fluid/finish: cum on face, cum on breasts, cum on ass, dripping cum, glistening skin, creampie, wet skin, covered
- Clothing: lingerie, thong, topless, nude, sheer fabric, see-through, partially undressed, fishnets, heels
- Lighting: soft studio light, rim lighting, warm backlight, candlelight, neon glow, hard shadows
- Quality tags: photorealistic, 8k, sharp focus, detailed skin, subsurface scattering, high detail, bokeh background
- Preserve what isn't being changed — always mention what to keep

PROMPT STRUCTURE:
- Prompt 1: concise edit instruction only (under 15 words, no quality tags)
- Prompt 2: full detailed prompt — pose, body, finish/clothing, lighting, background, quality tags
- Prompt 3: style/mood variant — different lighting or colour grade, same pose, with quality tags

OUTPUT RULES — follow exactly:
- Output exactly 3 prompts
- Each prompt on its own line
- No numbering, no bullet points, no labels, no blank lines, no preamble, no commentary

OUTPUT FORMAT (3 lines, nothing else):
<prompt 1>
<prompt 2>
<prompt 3>`;

function parsePrompts(text, count) {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^[\s\d.\-*>]+/, '').trim())
    .filter(l => l.length > 5);
  return lines.slice(0, count);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description, image } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userContent = image
    ? [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        { type: 'text', text: description.trim() },
      ]
    : description.trim();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = message.content[0].text.trim();
    const prompts = parsePrompts(text, 3);

    if (prompts.length !== 3) {
      return res.status(500).json({ error: `Expected 3 prompts, got ${prompts.length}. Raw: ${text.slice(0, 200)}` });
    }

    res.json({ prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'API call failed' });
  }
};
