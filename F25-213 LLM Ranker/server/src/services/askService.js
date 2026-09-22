const { randomUUID } = require('crypto')
const { aggregateFromProviders } = require('./apiAggregationService')
const { rankResponses } = require('./rankingService')
const { saveResponsesRecord } = require('../utils/responseStorage')
const { persistAggregatedResponses, saveScoresForBatch, ensureDefaultUserRankPreference } = require('../db/responseDb')
const {
  getConfiguredProviders,
  pickProvidersBySlotOrder,
  providerHasCredentials,
} = require('../config/providersConfig')

/**
 * Resolves configured providers with keys for the given panel slot order.
 * @param {number[]|null|undefined} providerSlotOrder - panel slots, or null/empty to use all configured
 */
function getRunnableProvidersForSlots(providerSlotOrder) {
  const all = getConfiguredProviders()
  let active = all

  if (Array.isArray(providerSlotOrder) && providerSlotOrder.length > 0) {
    active = pickProvidersBySlotOrder(all, providerSlotOrder)
    if (active.length === 0) {
      const err = new Error('None of the selected provider slots are configured on the server.')
      err.statusCode = 400
      throw err
    }
  }

  const runnable = []
  for (const p of active) {
    if (providerHasCredentials(p)) runnable.push(p)
    else console.warn(`[ask] Skipping slot ${p.slot} (${p.name}): no API key (or key placeholder in URL not filled).`)
  }

  if (runnable.length === 0) {
    const err = new Error(
      Array.isArray(providerSlotOrder) && providerSlotOrder.length > 0
        ? 'None of the selected models have API keys configured.'
        : 'No models with API keys are configured. Add API keys in server/.env.',
    )
    err.statusCode = 400
    throw err
  }

  return runnable
}

async function askAndRank(query, providerSlotOrder) {
  const runnable = getRunnableProvidersForSlots(providerSlotOrder)

  const aggregated = await aggregateFromProviders(query, runnable)
  const sqliteBatchId = randomUUID()
  persistAggregatedResponses(query, aggregated, sqliteBatchId)

  const ranked = await rankResponses(query, aggregated)

  saveScoresForBatch(
    sqliteBatchId,
    ranked.map((r) => ({ llm: r.ai, score: r.finalScore })),
    'embedding_tfidf',
  )
  ensureDefaultUserRankPreference(sqliteBatchId, query)

  const minimalResults = ranked.map((r, i) => ({
    ai: r.ai,
    response: r.response,
    rank: i + 1,
    score: r.finalScore,
  }))

  await saveResponsesRecord({ query, results: minimalResults })

  return minimalResults
}

module.exports = { askAndRank, getRunnableProvidersForSlots }

