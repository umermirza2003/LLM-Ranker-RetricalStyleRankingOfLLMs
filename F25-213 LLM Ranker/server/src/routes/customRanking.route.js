const { saveUserRankPreference } = require('../db/responseDb')

/**
 * POST body: { batchId, query, orderedLlms: string[] }
 * Persists user ordering for one rank batch (replacing any previous row for that batch).
 */
function postCustomRanking(req, res) {
  try {
    const batchId = req.body?.batchId != null ? String(req.body.batchId).trim() : ''
    const query = req.body?.query != null ? String(req.body.query).trim() : ''
    const orderedLlms = req.body?.orderedLlms
    if (!batchId) {
      return res.status(400).json({ error: 'batchId is required.' })
    }
    if (!query) {
      return res.status(400).json({ error: 'query is required.' })
    }
    if (!Array.isArray(orderedLlms)) {
      return res.status(400).json({ error: 'orderedLlms must be an array of model names.' })
    }
    const result = saveUserRankPreference(batchId, query, orderedLlms)
    if (!result.ok) {
      return res.status(400).json({ error: result.error })
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Save failed.' })
  }
}

module.exports = {
  postCustomRanking,
}
