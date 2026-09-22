const { GoogleGenAI } = require('@google/genai')
const { postJsonWithRetry } = require('../utils/httpClient')
const { extractTextFromAnyApiResponse, extractAnswerFromQueryAnswerFormat } = require('../utils/textExtraction')
const { getConfiguredProviders } = require('../config/providersConfig')

function injectApiKeyIntoUrl(url, apiKey, placeholderOpt) {
  if (!apiKey) return url
  if (!url) return url

  // Support a couple common placeholder patterns.
  let out = url
    .replaceAll('{{API_KEY}}', apiKey)
    .replaceAll('{API_KEY}', apiKey)

  if (placeholderOpt) {
    out = out.replaceAll(placeholderOpt, apiKey)
  }

  return out
}

function buildInstructionText(query, provider) {
  const forceFormat =
    process.env.FORCE_QUERY_ANSWER_FORMAT != null
      ? String(process.env.FORCE_QUERY_ANSWER_FORMAT).toLowerCase() !== 'false'
      : true

  const base = forceFormat
    ? `${query}\n\nReturn ONLY in this format:\nquery: ${query}\nanswer: <your answer>`
    : query

  const extra = typeof provider?.extraPrompt === 'string' ? provider.extraPrompt.trim() : ''
  if (!extra) return base

  return `${base}\n\n${extra}`
}

function buildGenericBody(query, instructionText) {
  return {
    query: instructionText,
    // Some APIs use prompt/chat format; harmless for providers that ignore unknown keys.
    prompt: `query: ${query}\nanswer: `,
  }
}

function buildOpenAIChatBody(query, instructionText, provider) {
  // OpenAI-compatible chat format.
  const model = provider.model || process.env.OPENAI_CHAT_MODEL || 'grok-4-1-fast'
  const temperature = process.env.OPENAI_CHAT_TEMPERATURE ? Number(process.env.OPENAI_CHAT_TEMPERATURE) : 0

  // Put the formatting instruction inside the user message so we can reliably extract `answer:`.
  return {
    model,
    messages: [
      {
        role: 'user',
        content: instructionText || query,
      },
    ],
    stream: false,
    temperature,
  }
}

function parseGeminiModelFromUrl(url) {
  if (!url) return ''
  // Example:
  // https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=...
  const m = url.match(/\/models\/([^/]+):generateContent/i)
  return m?.[1] || ''
}

async function callGeminiViaSdk(provider, instructionText) {
  if (!provider.key) throw new Error(`Missing API key for ${provider.name}`)

  const model = provider.model || parseGeminiModelFromUrl(provider.url) || 'gemini-3-flash-preview'

  // Official Google SDK.
  const client = new GoogleGenAI({ apiKey: provider.key })
  const result = await client.models.generateContent({
    model,
    contents: instructionText,
  })

  // SDK typically exposes `text`; keep fallbacks for safety.
  const generatedText = result?.text || result?.response?.text || ''
  const extracted = extractAnswerFromQueryAnswerFormat(generatedText) ?? generatedText
  return extractTextFromAnyApiResponse(extracted)
}

async function callProvider(provider, query, { timeoutMs, retryCount }) {
  const instructionText = buildInstructionText(query, provider)

  const requestBodyType = String(provider.requestBodyType).toLowerCase()

  if (requestBodyType === 'gemini') {
    const text = await callGeminiViaSdk(provider, instructionText)
    return { ai: provider.name, response: text }
  }

  const requestUrl = injectApiKeyIntoUrl(provider.url, provider.key, provider.keyUrlPlaceholder)

  const headers = { 'Content-Type': 'application/json' }

  // If the URL already contains `key=...`, don't add auth headers.
  const urlHasKeyQuery = requestUrl.includes('key=')
  if (provider.key && !urlHasKeyQuery) {
    headers.Authorization = `Bearer ${provider.key}`
    headers['x-api-key'] = provider.key
  }

  let body
  if (requestBodyType === 'openai_chat' || requestBodyType === 'chat_completions') {
    body = buildOpenAIChatBody(query, instructionText, provider)
  } else {
    body = buildGenericBody(query, instructionText)
  }

  const res = await postJsonWithRetry(requestUrl, headers, body, {
    timeoutMs,
    retryCount,
    retryOn: (statusCode) => statusCode >= 500,
  })

  const text = extractTextFromAnyApiResponse(res, { responseJsonPath: provider.responseJsonPath })
  return {
    ai: provider.name,
    response: text,
  }
}

async function aggregateFromProviders(query, providersSubset) {
  const providers = Array.isArray(providersSubset) ? providersSubset : getConfiguredProviders()

  if (providers.length === 0) {
    throw new Error(
      'No providers configured or selected. Define API slots in server/.env (API{n}_NAME and API{n}_URL for each slot you use).',
    )
  }

  const timeoutMs = process.env.API_TIMEOUT_MS ? Number(process.env.API_TIMEOUT_MS) : 20000
  const retryCount = process.env.API_RETRY_COUNT ? Number(process.env.API_RETRY_COUNT) : 2

  const results = await Promise.allSettled(
    providers.map((provider) =>
      callProvider(provider, query, {
        timeoutMs,
        retryCount,
      }),
    ),
  )

  // Ensure "graceful per-API errors":
  // - failed providers => "no response"
  // - fulfilled but extracted empty => "no response"
  return results.map((r, idx) => {
    const provider = providers[idx]
    const panelSlot =
      provider?.panelSlot != null && Number.isFinite(Number(provider.panelSlot))
        ? Number(provider.panelSlot)
        : null
    if (r.status === 'fulfilled') {
      const resp = r.value?.response
      const s = typeof resp === 'string' ? resp.trim() : ''
      return {
        ai: r.value?.ai || provider?.name || `API_${idx + 1}`,
        panelSlot,
        response: s ? resp : 'no response',
      }
    }
    return {
      ai: provider?.name || `API_${idx + 1}`,
      panelSlot,
      response: 'no response',
    }
  })
}

module.exports = { aggregateFromProviders }

