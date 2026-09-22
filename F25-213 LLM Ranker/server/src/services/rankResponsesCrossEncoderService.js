const path = require('path')
const { setTimeout: delay } = require('timers/promises')
const { randomUUID } = require('crypto')
const { aggregateFromProviders } = require('./apiAggregationService')
const { getRunnableProvidersForSlots } = require('./askService')
const {
  persistAggregatedResponses,
  getDbPath,
  saveScoresForBatch,
  ensureDefaultUserRankPreference,
} = require('../db/responseDb')
const { rankBatchFromSQLite } = require('./transformersRankClient')

function placeholderRankResults(aggregated) {
  const n = aggregated.length
  return aggregated.map((item, i) => {
    const score =
      n <= 1 ? 0.99 : parseFloat((0.95 - (i / Math.max(n - 1, 1)) * 0.45).toFixed(4))
    return {
      llm: item.ai,
      response: typeof item.response === 'string' ? item.response : '',
      score,
    }
  })
}

/**
 * Calls selected providers, writes rows to SQLite with a batch_id, then scores via
 * Python Transformers CrossEncoder (reads same DB). Falls back to placeholder scores
 * if the ranker service is down.
 * @param {string} query
 * @param {number[]} models - panel slot numbers
 */
async function rankResponsesWithCrossEncoder(query, models) {
  const runnable = getRunnableProvidersForSlots(models)
  const aggregated = await aggregateFromProviders(query, runnable)

  const batchId = randomUUID()
  persistAggregatedResponses(query, aggregated, batchId)

  const dbAbs = path.normalize(path.resolve(getDbPath()))

  const ms = Number(process.env.RANK_TRANSFORMERS_DELAY_MS)
  await delay(Number.isFinite(ms) && ms >= 0 ? ms : 250)

  try {
    const { results } = await rankBatchFromSQLite(batchId, dbAbs)
    if (Array.isArray(results) && results.length > 0) {
      saveScoresForBatch(batchId, results, 'cross_encoder')
      ensureDefaultUserRankPreference(batchId, query)
      return { query, batchId, results, scoreSource: 'cross_encoder' }
    }
    console.warn(
      '[rankResponses] Ranker returned no results; check Python logs and DB batch_id.',
    )
  } catch (err) {
    console.warn('[rankResponses] CrossEncoder unreachable — placeholder scores:', err.message)
    console.warn('  Confirm rank_transformers_service.py is running on', process.env.RANK_TRANSFORMERS_SERVICE_URL || 'http://127.0.0.1:5056')
  }

  const placeholder = placeholderRankResults(aggregated)
  saveScoresForBatch(batchId, placeholder, 'placeholder')
  ensureDefaultUserRankPreference(batchId, query)
  return { query, batchId, results: placeholder, scoreSource: 'placeholder' }
}

module.exports = { rankResponsesWithCrossEncoder }
