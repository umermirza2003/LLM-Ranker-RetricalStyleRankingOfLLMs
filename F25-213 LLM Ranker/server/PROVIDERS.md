# Provider setup

**Runnable backends** are read from **`API1_` … `API5_`** only (Gemini + up to four HF chat models).

**Panel mapping** (`GET /providers` IDs are **panel slots**):

| Env block | Panel slot | Label |
|-----------|-------------|--------|
| `API1_*` | 1 | Gemini |
| `API3_*` | 2 | Chat GPT |
| `API5_*` | 8 | DeepSeek |
| `API2_*` | 23 | Mistral |
| `API4_*` | 30 | Llama |

Slots **3–7, 9–22, 24–29** appear in the UI **without** backends (dimmed).

The UI exposes **30** panel rows by default. Set **`API_MAX_SLOTS`** (1–100) for extra blank rows (`LLM 31`, …).

Other sections below still apply to each **`API{i}_*`** env block shape.

Each **`API1` … `API5`** block needs **both** **`NAME`** and **`URL`** to run. Labels for all **30** panel rows come from the server catalogue (see mapping above).

Public catalogue (**`GET /providers`**): **`slot`** is **panel slot** **`1`** … **`30`**; **`name`**, **`configured`**, **`hasApiKey`** (no URLs or secrets). Only mapped panels (**1**, **2**, **8**, **23**, **30**) can be runnable when **`API1` … `API5`** are filled.

## Variables (per slot `i`)

- `API{i}_NAME` — display name (required with URL)
- `API{i}_URL` — endpoint URL (required with NAME)
- `API{i}_KEY` — secret; **never** returned by `GET /providers`
- `API{i}_REQUEST_BODY_TYPE` (optional)
  - `generic` (default): JSON `{ query, prompt }`
  - `gemini`: `@google/genai` SDK
  - `openai_chat` / `chat_completions`: OpenAI-style chat body
- `API{i}_MODEL` — model id for `openai_chat` / `gemini` as needed
- `API{i}_RESPONSE_JSON_PATH` — optional dot-path for response text
- `API{i}_KEY_URL_PLACEHOLDER` — optional custom placeholder for key injection into URL

## `POST /ask`

Body: `{ "query": "...", "providerIndices": [1, 2, 8] }` (optional): values are **panel slot** numbers (**1**, **2**, **8**, **23**, **30**). If omitted or empty, **all** wired backends are used.

## Response format

The server asks providers to return `query:` / `answer:` lines when `FORCE_QUERY_ANSWER_FORMAT` is enabled.

## Templates

Use **`server/.env.example`** or **`server/models.env.example`** as blanks-only templates (API1 … API29 plus global embeddings / timeout / ranking weights).
