# wan-prompt-engine

This repository contains two applications served from the same Express server:

1. **WAN Prompt Engine** — AI-assisted video/image prompt writer, served at `/`
2. **AI Companion Chat App** — persona chat with image generation, served at `/companion`

---

## AI Companion Chat App

### What it does

- Chat with an AI persona via a streaming (SSE) interface
- The persona can generate images inline using a `[IMAGE: description]` marker in its replies
- Conversation history persisted to SQLite
- Mobile-first dark-theme UI (React + Vite)

### Prerequisites

- Node.js 18+
- An OpenAI-compatible chat endpoint (OpenAI, Ollama, LM Studio, vLLM, etc.)
- ComfyUI running locally or accessible via HTTP (for image generation)

### Setup

```bash
# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env
# Edit .env — at minimum set CHAT_API_URL, CHAT_API_KEY, CHAT_MODEL

# Build the React frontend (only needed once, or after UI changes)
cd client && npm install && npm run build && cd ..

# Start the server
npm start
```

Open `http://localhost:3000/companion` in your browser.

---

### Pointing it at a chat endpoint

Set these three vars in `.env`:

```
CHAT_API_URL=https://api.openai.com/v1   # or http://localhost:11434/v1 for Ollama
CHAT_API_KEY=sk-...                       # leave blank for local endpoints that don't require auth
CHAT_MODEL=gpt-4o                         # model name string passed to the API
```

Any OpenAI-compatible endpoint works: OpenAI, Azure OpenAI, Ollama, LM Studio, vLLM, Mistral, etc.

---

### Writing the persona system prompt

Create a plain text file with your persona instructions, then set:

```
SYSTEM_PROMPT_PATH=/path/to/my_persona.txt
```

The file is read on every request, so you can edit it without restarting the server.

To trigger image generation, instruct the model to emit `[IMAGE: <description>]` anywhere in its reply. The backend strips this marker from the visible chat text, runs the description through `promptTemplate()`, calls ComfyUI, and inserts the image into the conversation.

---

### Pointing it at ComfyUI

```
IMAGE_API_URL=http://localhost:8188
COMFY_WORKFLOW_PATH=/path/to/my_workflow.json
COMFY_PROMPT_NODE_ID=6     # node that receives the prompt text
COMFY_SEED_NODE_ID=3       # node that receives the random seed
```

The workflow JSON is the same file you'd export from the ComfyUI web interface. The app injects the prompt text and a fresh random seed on every call, then polls `/history/{id}` until the output image is ready.

**Swapping the workflow:** change `COMFY_WORKFLOW_PATH` and update the node IDs if your new workflow uses different node numbers. No code changes required.

---

### Customising the image prompt

Edit `api/lib/promptTemplate.js`:

```js
function promptTemplate(description) {
  // Add quality tags, LoRA triggers, style tokens here
  return `masterpiece, best quality, ${description}`;
}
```

Or use the `IMAGE_PROMPT_PREFIX` / `IMAGE_PROMPT_SUFFIX` env vars for simple prefix/suffix wrapping without code changes.

---

### API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/companion/conversations` | Create a new conversation. Returns `{ id, title, created_at }` |
| `GET`  | `/api/companion/conversations/:id` | Fetch full message history for a conversation |
| `POST` | `/api/companion/chat` | Send a message; streams response via SSE |
| `POST` | `/api/companion/image` | Generate an image directly from a prompt |

**SSE events from `/api/companion/chat`:**

| Event | Payload | Description |
|-------|---------|-------------|
| `token` | `{ text }` | Incremental chat token |
| `done`  | `{ text }` | Full cleaned response text |
| `error` | `{ message }` | Error occurred |
| `image_start` | `{ description }` | Image generation started |
| `image_done`  | `{ base64, mimeType, prompt }` | Image ready |
| `image_error` | `{ message }` | Image generation failed |

---

## WAN Prompt Engine (original)

The original prompt-writing tool is served at `http://localhost:3000/`. See `api/chat.js` for the system prompt and `api/lib/openrouter.js` for the model configuration. Requires `OPENROUTER_API_KEY` and `POSTGRES_URL` in `.env`.
