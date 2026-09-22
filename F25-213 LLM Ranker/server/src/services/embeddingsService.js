const { cosineSimilarity } = require('../utils/cosineSimilarity')

function getEmbeddingsConfig() {
  return {
    url: process.env.EMBEDDINGS_API_URL || process.env.OPENAI_EMBEDDINGS_URL || '',
    key: process.env.EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.EMBEDDINGS_MODEL || process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    timeoutMs: process.env.EMBEDDINGS_TIMEOUT_MS ? Number(process.env.EMBEDDINGS_TIMEOUT_MS) : 30000,
  }
}

function toVectorList(payload) {
  // OpenAI-like: { data: [ { embedding: [...] }, ... ] }
  if (payload && Array.isArray(payload.data)) {
    const vectors = payload.data.map((d) => d?.embedding).filter(Array.isArray)
    if (vectors.length > 0) return vectors
  }

  // Alternate: { embeddings: [ [...], ... ] }
  if (payload && Array.isArray(payload.embeddings)) {
    const vectors = payload.embeddings.filter(Array.isArray)
    if (vectors.length > 0) return vectors
  }

  return null
}

async function getEmbeddingsForTexts(texts) {
  const { url, key, model, timeoutMs } = getEmbeddingsConfig()
  if (!url) throw new Error('Embeddings API URL is missing. Set EMBEDDINGS_API_URL in server/.env')

  if (!Array.isArray(texts) || texts.length === 0) return []

  const headers = {
    'Content-Type': 'application/json',
  }
  if (key) {
    headers.Authorization = `Bearer ${key}`
    headers['x-api-key'] = key
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        input: texts,
      }),
      signal: controller.signal,
    })

    const contentType = res.headers.get('content-type') || ''
    const payload = contentType.includes('application/json') ? await res.json() : await res.text().catch(() => ({}))

    if (!res.ok) {
      throw new Error(`Embeddings request failed: HTTP ${res.status}`)
    }

    const vectors = toVectorList(payload)
    if (!vectors || vectors.length !== texts.length) {
      throw new Error('Embeddings response format not recognized (vector count mismatch).')
    }

    return vectors
  } finally {
    clearTimeout(timer)
  }
}

function normalizeCosineTo01(cos) {
  // Cosine similarity is in [-1, 1] for typical embedding spaces.
  return (Number(cos) + 1) / 2
}

function cosineSimilarityNormalized(a, b) {
  return normalizeCosineTo01(cosineSimilarity(a, b))
}

module.exports = { getEmbeddingsForTexts, cosineSimilarityNormalized }

