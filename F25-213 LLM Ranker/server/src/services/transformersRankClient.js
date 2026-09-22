/**
 * Calls the Python Transformers CrossEncoder service (model loaded once in that process).
 * Scores responses read from SQLite by batch_id.
 */

function getRankFromDbEndpoint() {
  const raw = process.env.RANK_TRANSFORMERS_SERVICE_URL || 'http://127.0.0.1:5056'
  const u = new URL(raw.replace(/\/$/, ''))
  return `${u.origin}/rank-from-db`
}

/**
 * @param {string} batchId
 * @param {string} dbPathAbsolute
 * @returns {Promise<{ query: string, results: { llm: string, response: string, score: number }[] }>}
 */
async function rankBatchFromSQLite(batchId, dbPathAbsolute) {
  const url = getRankFromDbEndpoint()
  const timeoutMs = process.env.RANK_TRANSFORMERS_TIMEOUT_MS
    ? Number(process.env.RANK_TRANSFORMERS_TIMEOUT_MS)
    : 180000

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        dbPath: dbPathAbsolute,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    const hint =
      typeof e?.name === 'string' && e.name === 'TimeoutError'
        ? 'Transformers ranking service timed out.'
        : `Cannot reach Transformers ranker (${e?.message || e}). Start: python server/python/rank_transformers_service.py`
    const err = new Error(hint)
    err.statusCode = 503
    throw err
  }

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    const err = new Error('Ranking service returned invalid JSON.')
    err.statusCode = 502
    throw err
  }

  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : `Ranking error (${res.status})`
    const err = new Error(msg)
    err.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502
    throw err
  }

  const results = Array.isArray(data.results) ? data.results : []
  const q = typeof data.query === 'string' ? data.query : ''
  return { query: q, results }
}

module.exports = { rankBatchFromSQLite }
