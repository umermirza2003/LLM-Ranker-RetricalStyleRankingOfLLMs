const { tfidfCosineSimilarity } = require('../utils/tfidfService')
const { getEmbeddingsForTexts, cosineSimilarityNormalized } = require('./embeddingsService')

function clamp01(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return 0
  return Math.min(1, Math.max(0, x))
}

function getWeights() {
  const tfidfW = process.env.TFIDF_WEIGHT != null ? Number(process.env.TFIDF_WEIGHT) : 0.4
  const embW = process.env.EMBEDDING_WEIGHT != null ? Number(process.env.EMBEDDING_WEIGHT) : 0.6

  const sum = tfidfW + embW
  if (!sum) return { tfidfW: 0.4, embW: 0.6 }

  return {
    tfidfW: tfidfW / sum,
    embW: embW / sum,
  }
}

async function rankResponses(query, aggregatedResponses) {
  const items = Array.isArray(aggregatedResponses) ? aggregatedResponses : []
  const weights = getWeights()

  function responseToScoringText(resp) {
    const s = String(resp ?? '')
    if (!s.trim()) return ''
    if (s.trim().toLowerCase() === 'no response') return ''
    return s
  }

  // Compute TF-IDF scores first (cheap and always available).
  const tfidfScores = items.map((r) => tfidfCosineSimilarity(query, responseToScoringText(r?.response)))

  // Compute embedding similarities for non-empty responses.
  const nonEmptyIdx = []
  const nonEmptyTexts = []
  items.forEach((r, idx) => {
    const t = responseToScoringText(r?.response)
    if (t.trim().length > 0) {
      nonEmptyIdx.push(idx)
      nonEmptyTexts.push(t)
    }
  })

  let embeddingScores = items.map(() => 0)
  if (nonEmptyTexts.length > 0) {
    try {
      const vectors = await getEmbeddingsForTexts([query, ...nonEmptyTexts])
      const queryVec = vectors[0]

      nonEmptyIdx.forEach((idx, j) => {
        const respVec = vectors[j + 1]
        embeddingScores[idx] = cosineSimilarityNormalized(queryVec, respVec)
      })
    } catch (_err) {
      // Gracefully degrade: if embeddings fail, ranking is TF-IDF only.
      embeddingScores = items.map(() => 0)
    }
  }

  const ranked = items.map((r, idx) => {
    const tfidfScore = clamp01(tfidfScores[idx])
    const embeddingSim = clamp01(embeddingScores[idx])
    const finalScore = weights.tfidfW * tfidfScore + weights.embW * embeddingSim

    return {
      ai: r.ai,
      response: r.response,
      finalScore,
    }
  })

  ranked.sort((a, b) => b.finalScore - a.finalScore)
  return ranked
}

module.exports = { rankResponses }

