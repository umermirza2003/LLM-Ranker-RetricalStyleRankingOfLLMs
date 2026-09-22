const {
  listQueryHistoryBatches,
  getQueryHistoryBatchDetail,
} = require('../db/responseDb')

function clampLimit(raw, fallback = 80, max = 200) {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.max(1, n))
}

function getQueryHistory(req, res) {
  try {
    const limit = clampLimit(req.query.limit)
    const batches = listQueryHistoryBatches(limit)
    res.status(200).json({ batches })
  } catch (err) {
    res.status(500).json({ error: err.message || 'History lookup failed.' })
  }
}

function getQueryHistoryBatch(req, res) {
  try {
    const batchId = req.params.batchId ? String(req.params.batchId).trim() : ''
    if (!batchId) {
      return res.status(400).json({ error: 'Missing batch id.' })
    }
    const detail = getQueryHistoryBatchDetail(batchId)
    if (!detail) {
      return res.status(404).json({ error: 'Batch not found.' })
    }
    res.status(200).json(detail)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Batch lookup failed.' })
  }
}

module.exports = {
  getQueryHistory,
  getQueryHistoryBatch,
}
