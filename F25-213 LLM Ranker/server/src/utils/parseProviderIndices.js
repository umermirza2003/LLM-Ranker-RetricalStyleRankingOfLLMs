/**
 * Normalizes client-provided slot numbers for POST /ask.
 * Returns null when the client did not filter (use all configured providers).
 */
function parseProviderIndices(body) {
  const raw =
    body?.providerIndices ?? body?.providers ?? body?.slots ?? body?.provider_indices ?? undefined

  if (raw === undefined || raw === null) return null

  if (!Array.isArray(raw)) {
    const err = new Error('providerIndices must be an array of positive integers (API slot numbers)')
    err.statusCode = 400
    throw err
  }

  const out = []
  for (const item of raw) {
    const n = Math.trunc(Number(item))
    if (Number.isFinite(n) && n >= 1) out.push(n)
  }

  // Empty array → no filter (same as omitting the field)
  return out.length === 0 ? null : out
}

module.exports = { parseProviderIndices }
