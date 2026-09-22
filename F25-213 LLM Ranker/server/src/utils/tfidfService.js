const natural = require('natural')

function tfidfCosineSimilarity(query, response) {
  const safeQuery = String(query ?? '')
  const safeResp = String(response ?? '')

  if (!safeQuery.trim() || !safeResp.trim()) return 0

  const tfidf = new natural.TfIdf()
  tfidf.addDocument(safeQuery)
  tfidf.addDocument(safeResp)

  const qTerms = tfidf.listTerms(0) || []
  const rTerms = tfidf.listTerms(1) || []

  const qMap = new Map()
  for (const t of qTerms) qMap.set(t.term, t.tfidf)

  const rMap = new Map()
  for (const t of rTerms) rMap.set(t.term, t.tfidf)

  // Sparse cosine similarity over union of terms
  let dot = 0
  let normQ = 0
  let normR = 0

  for (const v of qMap.values()) normQ += v * v
  for (const v of rMap.values()) normR += v * v

  if (!normQ || !normR) return 0

  const [small, large] = qMap.size <= rMap.size ? [qMap, rMap] : [rMap, qMap]
  for (const [term, w] of small.entries()) {
    const other = large.get(term)
    if (other != null) dot += w * other
  }

  return dot / (Math.sqrt(normQ) * Math.sqrt(normR))
}

module.exports = { tfidfCosineSimilarity }

