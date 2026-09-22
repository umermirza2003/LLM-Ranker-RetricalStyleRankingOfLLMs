/**
 * Calls the Python CrossEncoder service (single long-lived process; model loaded once there).
 */

function getRankEndpoint() {
  const raw = process.env.RANKING_SERVICE_URL || 'http://127.0.0.1:5055'
  const u = new URL(raw.replace(/\/$/, ''))
  return `${u.origin}/rank`
}

/**
 * @param {string} query
 * @param {{ llm: string, response: string }[]} llmResponses
 * @param {{ preserveOrder?: boolean }} [options]
 * @returns {Promise<{ llm: string, response: string, score: number }[]>}
 */
async function scoreWithCrossEncoder(query, llmResponses, options = {}) {
  const { preserveOrder = false } = options
  const url = getRankEndpoint()
  const timeoutMs = process.env.RANKING_SERVICE_TIMEOUT_MS ? Number(process.env.RANKING_SERVICE_TIMEOUT_MS) : 120000

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        responses: llmResponses,
        preserve_order: preserveOrder,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    const aborted =
      typeof e?.name === 'string' && (e.name === 'AbortError' || e.name === 'TimeoutError')
    const hint = aborted
      ? `Ranking service timed out after ${timeoutMs}ms (set RANKING_SERVICE_TIMEOUT_MS).`
      : `Cannot reach CrossEncoder ranking service. Start: cd server/python && python ranking_service.py (${e?.message || e})`
    const err = new Error(hint)
    err.statusCode = 503
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  let data
  const text = await res.text()
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    const err = new Error('Ranking service returned invalid JSON.')
    err.statusCode = 502
    throw err
  }

  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : `Ranking service error (${res.status})`
    const err = new Error(msg)
    err.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502
    throw err
  }

  return Array.isArray(data.results) ? data.results : []
}

module.exports = { scoreWithCrossEncoder }
