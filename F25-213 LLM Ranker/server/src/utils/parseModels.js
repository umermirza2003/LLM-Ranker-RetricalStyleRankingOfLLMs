/**
 * Parses required `models` from POST body: array of positive integers (panel slot numbers).
 */
function parseModelsRequired(body) {
  const raw = body?.models
  if (!Array.isArray(raw) || raw.length === 0) {
    const err = new Error('Body must include a non-empty "models" array (panel slot numbers).')
    err.statusCode = 400
    throw err
  }

  const out = []
  for (const item of raw) {
    const n = Math.trunc(Number(item))
    if (Number.isFinite(n) && n >= 1) out.push(n)
  }

  if (out.length === 0) {
    const err = new Error('models must contain positive integers (panel slot numbers).')
    err.statusCode = 400
    throw err
  }

  return out
}

module.exports = { parseModelsRequired }
