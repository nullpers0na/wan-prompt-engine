const fs = require('fs');
const path = require('path');

const BASE_URL = () => (process.env.IMAGE_API_URL || 'http://localhost:8188').replace(/\/$/, '');
const WORKFLOW_PATH = () => process.env.COMFY_WORKFLOW_PATH || path.join(__dirname, '../../comfy_workflow.json');
const PROMPT_NODE = () => process.env.COMFY_PROMPT_NODE_ID || '6';
const SEED_NODE   = () => process.env.COMFY_SEED_NODE_ID   || '3';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS  = parseInt(process.env.COMFY_TIMEOUT_MS || '120000', 10);

function loadWorkflow() {
  const wfPath = WORKFLOW_PATH();
  if (!fs.existsSync(wfPath)) {
    throw new Error(`ComfyUI workflow file not found: ${wfPath}. Set COMFY_WORKFLOW_PATH in .env.`);
  }
  return JSON.parse(fs.readFileSync(wfPath, 'utf8'));
}

function injectPromptAndSeed(workflow, promptText) {
  const wf = JSON.parse(JSON.stringify(workflow));
  const promptNode = PROMPT_NODE();
  const seedNode   = SEED_NODE();

  if (!wf[promptNode]) throw new Error(`Prompt node "${promptNode}" not found in workflow.`);
  if (!wf[seedNode])   throw new Error(`Seed node "${seedNode}" not found in workflow.`);

  const node = wf[promptNode];
  if (node.inputs) {
    const textKey = Object.keys(node.inputs).find(k =>
      typeof node.inputs[k] === 'string' &&
      (k === 'text' || k === 'positive' || k === 'prompt')
    ) || Object.keys(node.inputs).find(k => typeof node.inputs[k] === 'string');
    if (textKey) node.inputs[textKey] = promptText;
  }

  const seedNodeObj = wf[seedNode];
  if (seedNodeObj?.inputs) {
    const seedKey = Object.keys(seedNodeObj.inputs).find(k =>
      k === 'seed' || k === 'noise_seed'
    );
    if (seedKey) {
      seedNodeObj.inputs[seedKey] = Math.floor(Math.random() * 2 ** 32);
    }
  }

  return wf;
}

async function queuePrompt(workflow) {
  const res = await fetch(`${BASE_URL()}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`ComfyUI queue error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.prompt_id) throw new Error(`ComfyUI did not return a prompt_id`);
  return data.prompt_id;
}

async function pollHistory(promptId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${BASE_URL()}/history/${promptId}`);
    if (!res.ok) continue;
    const data = await res.json();
    const entry = data[promptId];
    if (!entry?.outputs) continue;
    const outputs = entry.outputs;
    for (const nodeId of Object.keys(outputs)) {
      const images = outputs[nodeId]?.images;
      if (images?.length) return images[0];
    }
  }
  throw new Error('ComfyUI image generation timed out.');
}

async function fetchImage(imageInfo) {
  const { filename, subfolder, type } = imageInfo;
  const params = new URLSearchParams({ filename, subfolder: subfolder || '', type: type || 'output' });
  const res = await fetch(`${BASE_URL()}/view?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  const ct = res.headers.get('content-type') || 'image/png';
  return { base64: b64, mimeType: ct };
}

async function generateImage(promptText) {
  const workflow = loadWorkflow();
  const injected = injectPromptAndSeed(workflow, promptText);
  const promptId = await queuePrompt(injected);
  const imageInfo = await pollHistory(promptId);
  return fetchImage(imageInfo);
}

module.exports = { generateImage };
