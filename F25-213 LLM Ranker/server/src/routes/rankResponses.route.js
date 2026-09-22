const { parseModelsRequired } = require('../utils/parseModels')
const { rankResponsesWithCrossEncoder } = require('../services/rankResponsesCrossEncoderService')
const { reorderResultsByUserPreference } = require('../db/responseDb')

/**
 * POST /rank-responses and POST /api/rank-responses — mounted directly on app in app.js
 * (avoids Express Router mount edge cases with Express 5).
 */
async function postRankResponses(req, res, next) {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
    if (!query) {
      return res.status(400).json({
        error: 'Body must include { "query": "...", "models": [1, 2, ...] }.',
      })
    }

    const models = parseModelsRequired(req.body)
    const { query: q, batchId, results, scoreSource } = await rankResponsesWithCrossEncoder(query, models)
    const ordered =
      typeof batchId === 'string' && batchId.trim()
        ? reorderResultsByUserPreference(batchId.trim(), results)
        : results
    return res.status(200).json({
      query: q,
      batchId: batchId || undefined,
      results: ordered,
      scoreSource: scoreSource || 'placeholder',
    })
  } catch (err) {
    return next(err)
  }
}

module.exports = { postRankResponses }
