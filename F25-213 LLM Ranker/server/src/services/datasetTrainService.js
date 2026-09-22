const { scoreWithCrossEncoder } = require('./crossEncoderClient')
const { getModelStatistics } = require('../db/responseDb')

function normName(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

/** Alphanumeric only — helps match "Chat gpt" to stored "ChatGPT" */
function slugAlnum(s) {
  return normName(s).replace(/[^a-z0-9]/g, '')
}

/**
 * Prefer combinedScore from model statistics; fall back to preview-only or rank-only.
 * @param {object} m
 * @returns {number|null}
 */
function effectiveSystemScore(m) {
  if (!m || typeof m !== 'object') return null
  const c = m.combinedScore
  if (c != null && Number.isFinite(Number(c))) return Number(c)
  const p = m.avgPreviewScore
  if (p != null && Number.isFinite(Number(p))) return Number(p)
  const r = m.avgRankScore
  if (r != null && Number.isFinite(Number(r))) return Number(r)
  return null
}

/**
 * Match upload row LLM name to a row from getModelStatistics().models (fuzzy).
 * @param {string} uploadLlm
 * @param {object[]} models
 * @returns {object|null}
 */
function findStatForUploadLlm(uploadLlm, models) {
  if (!uploadLlm || !Array.isArray(models)) return null
  const withScore = models.filter((m) => effectiveSystemScore(m) != null)
  if (withScore.length === 0) return null

  const u = normName(uploadLlm)
  const uSlug = slugAlnum(uploadLlm)
  if (!u && !uSlug) return null

  for (const m of withScore) {
    if (normName(m.llm) === u) return m
  }

  if (uSlug.length >= 2) {
    for (const m of withScore) {
      if (slugAlnum(m.llm) === uSlug) return m
    }
  }

  if (uSlug.length >= 3) {
    for (const m of withScore) {
      const ms = slugAlnum(m.llm)
      if (!ms) continue
      if (ms.includes(uSlug) || uSlug.includes(ms)) return m
    }
  }

  const uTokens = u.split(/\s+/).filter((t) => t.length >= 2)
  if (uTokens.length >= 1) {
    for (const m of withScore) {
      const mt = normName(m.llm)
      if (uTokens.every((t) => mt.includes(t))) return m
    }
  }

  return null
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0
  return Math.min(1, Math.max(0, x))
}

function blendWeight() {
  const raw = process.env.TRAIN_SYSTEM_BLEND
  const n = raw != null && raw !== '' ? Number(raw) : 0.35
  if (!Number.isFinite(n)) return 0.35
  return clamp01(n)
}

/** Same shape as live ranking placeholder when CrossEncoder is unreachable */
function placeholderScoresInOrder(n) {
  return Array.from({ length: n }, (_, i) =>
    n <= 1 ? 0.99 : parseFloat((0.95 - (i / Math.max(n - 1, 1)) * 0.45).toFixed(4)),
  )
}

function buildPlaceholderCeResults(rows) {
  const scores = placeholderScoresInOrder(rows.length)
  return rows.map((r, i) => ({
    llm: r.llm,
    response: r.response,
    score: scores[i],
  }))
}

/**
 * One query + table — CrossEncoder + system blend.
 * @param {{ query: string, rows: { id?: string, llm: string, response: string }[] }} payload
 */
async function computeSingleTrainingRun(payload) {
  const query = typeof payload.query === 'string' ? payload.query.trim() : ''
  const rowsIn = Array.isArray(payload.rows) ? payload.rows : []

  if (!query) {
    const err = new Error('query is required.')
    err.statusCode = 400
    throw err
  }
  if (rowsIn.length === 0) {
    const err = new Error('At least one LLM row is required.')
    err.statusCode = 400
    throw err
  }

  const rows = rowsIn.map((r, i) => ({
    id: r.id != null ? String(r.id) : String(i + 1),
    llm: String(r.llm ?? '').trim() || `Model ${i + 1}`,
    response: typeof r.response === 'string' ? r.response : String(r.response ?? ''),
  }))

  const llmResponses = rows.map((r) => ({ llm: r.llm, response: r.response }))

  let ceResults
  let crossEncoderMode = 'live'
  let crossEncoderWarning = null

  try {
    ceResults = await scoreWithCrossEncoder(query, llmResponses, { preserveOrder: true })
  } catch (e) {
    console.warn('[datasetTrain] CrossEncoder unavailable — using placeholder scores:', e?.message || e)
    crossEncoderMode = 'fallback'
    crossEncoderWarning =
      typeof e?.message === 'string'
        ? e.message
        : 'CrossEncoder ranking service did not respond.'
    ceResults = buildPlaceholderCeResults(rows)
  }

  if (!Array.isArray(ceResults) || ceResults.length !== rows.length) {
    console.warn('[datasetTrain] CrossEncoder bad length — using placeholder scores.')
    crossEncoderMode = 'fallback'
    if (!crossEncoderWarning) {
      crossEncoderWarning = 'CrossEncoder returned an unexpected result; placeholder scores were used.'
    }
    ceResults = buildPlaceholderCeResults(rows)
  }

  const rawCe = ceResults.map((r, i) => {
    const s = r?.score
    return typeof s === 'number' && Number.isFinite(s) ? s : Number(s) || 0
  })

  const minC = Math.min(...rawCe)
  const maxC = Math.max(...rawCe)

  const ceNormForIndex = (idx) => {
    const s = rawCe[idx]
    if (maxC === minC) return 1
    return clamp01((s - minC) / (maxC - minC))
  }

  const stats = getModelStatistics()
  const statModels = Array.isArray(stats.models) ? stats.models : []

  const W = blendWeight()

  /** System scores for rows in this batch that matched DB statistics (for min–max norm across batch) */
  const systemVals = []
  for (const r of rows) {
    const st = findStatForUploadLlm(r.llm, statModels)
    const eff = st ? effectiveSystemScore(st) : null
    if (eff != null) systemVals.push(eff)
  }
  const sysMin = systemVals.length ? Math.min(...systemVals) : 0
  const sysMax = systemVals.length ? Math.max(...systemVals) : 1

  let rowsWithSystem = 0
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const ceRaw = rawCe[i]
    const ceN = ceNormForIndex(i)
    const st = findStatForUploadLlm(r.llm, statModels)
    let systemCombined = null
    let sysN = null
    let aggregated = ceN
    let matchedStatLlm = null

    if (st && systemVals.length > 0) {
      systemCombined = effectiveSystemScore(st)
      matchedStatLlm = st.llm
      if (systemCombined != null && Number.isFinite(systemCombined)) {
        rowsWithSystem += 1
        sysN = sysMax === sysMin ? 1 : (systemCombined - sysMin) / (sysMax - sysMin)
        aggregated = W * ceN + (1 - W) * clamp01(sysN)
      }
    }

    out.push({
      id: r.id,
      llm: r.llm,
      response: r.response,
      crossEncoderScore: ceRaw,
      crossEncoderNorm: ceN,
      systemCombinedScore: systemCombined,
      systemNorm: sysN,
      usesSystemStats: systemCombined != null,
      matchedStatLlm,
      aggregatedScore: aggregated,
    })
  }

  out.sort((a, b) => b.aggregatedScore - a.aggregatedScore)
  out.forEach((row, idx) => {
    row.rank = idx + 1
  })

  const chartPoints = out.map((r) => ({
    llm: r.llm,
    aggregatedScore: r.aggregatedScore,
    crossEncoderNorm: r.crossEncoderNorm,
    hasSystem: Boolean(r.usesSystemStats),
  }))

  const modelsWithNumericStat = statModels.filter((m) => effectiveSystemScore(m) != null).length
  let systemStatsHint = null
  if (stats.batchCount === 0 || modelsWithNumericStat === 0) {
    systemStatsHint =
      'No model statistics in the app database yet — run ranked queries on Home so SQLite has history; until then only CrossEncoder scores apply.'
  } else if (rowsWithSystem === 0) {
    systemStatsHint =
      'Model statistics exist but no upload row matched a known LLM name — align names with the Model statistics page (fuzzy match failed).'
  }

  return {
    query,
    blendWeight: W,
    crossEncoderMode,
    crossEncoderWarning,
    systemStatsAvailable: systemVals.length > 0,
    systemStatsDetail: {
      dbBatchCount: stats.batchCount ?? 0,
      modelsInDb: statModels.length,
      modelsWithScore: modelsWithNumericStat,
      uploadRowsMatchedSystem: rowsWithSystem,
      blendCrossEncoderWeight: W,
    },
    systemStatsHint,
    bestSystemModel: stats.bestModel
      ? { llm: stats.bestModel.llm, combinedScore: stats.bestModel.combinedScore }
      : null,
    rows: out,
    chartPoints,
  }
}

/**
 * @param {object[]} perQuery - results from computeSingleTrainingRun + sheetName, runIndex
 */
function buildMultiQueryResponse(perQuery) {
  const W = blendWeight()

  /** @type {Map<string, { display: string, agg: number[], ce: number[] }>} */
  const byLlm = new Map()
  for (const pq of perQuery) {
    for (const row of pq.rows) {
      const k = normName(row.llm)
      if (!k) continue
      if (!byLlm.has(k)) {
        byLlm.set(k, { display: row.llm, agg: [], ce: [] })
      }
      const b = byLlm.get(k)
      b.agg.push(Number(row.aggregatedScore) || 0)
      b.ce.push(Number(row.crossEncoderNorm) || 0)
    }
  }

  const llmSummary = [...byLlm.entries()]
    .map(([key, b]) => {
      const n = b.agg.length
      const meanAggregated = n ? b.agg.reduce((a, x) => a + x, 0) / n : 0
      const meanCeNorm = n ? b.ce.reduce((a, x) => a + x, 0) / n : 0
      return {
        llm: b.display,
        normKey: key,
        queryCount: n,
        meanAggregated,
        meanCeNorm,
      }
    })
    .sort((a, b) => b.meanAggregated - a.meanAggregated)

  llmSummary.forEach((r, i) => {
    r.rank = i + 1
  })

  /** All LLMs (globally mean-ranked); client picks how many lines to draw (top n). */
  const topLlms = llmSummary.map((t, i) => ({
    ...t,
    chartKey: `L${i}`,
  }))

  /** Line chart: one point per query, series = each LLM's aggregated score at that query */
  const queryLineData = perQuery.map((pq, qi) => {
    const label =
      (pq.sheetName ? `${pq.sheetName}: ` : '') +
      (pq.query.length > 48 ? `${pq.query.slice(0, 46)}…` : pq.query || `Q${qi + 1}`)
    const point = {
      queryLabel: label,
      sheetName: pq.sheetName || '',
      fullQuery: pq.query,
      runIndex: qi,
    }
    const rowByNorm = new Map(pq.rows.map((r) => [normName(r.llm), r]))
    for (const top of topLlms) {
      const hit = rowByNorm.get(top.normKey)
      point[top.chartKey] = hit ? Number(hit.aggregatedScore) : null
    }
    return point
  })

  const llmLineMeta = topLlms.map((t) => ({ key: t.chartKey, llm: t.llm }))

  /** Flat rows for export */
  const flatRows = []
  perQuery.forEach((pq, qi) => {
    pq.rows.forEach((r) => {
      flatRows.push({
        sheetName: pq.sheetName,
        query: pq.query,
        queryIndex: qi,
        ...r,
      })
    })
  })

  const crossEncoderMode = perQuery.some((p) => p.crossEncoderMode === 'fallback')
    ? 'fallback'
    : 'live'
  const crossEncoderWarning = perQuery.map((p) => p.crossEncoderWarning).filter(Boolean)[0] || null

  const summaryRows = llmSummary.map((s) => ({
    rank: s.rank,
    llm: s.llm,
    aggregatedScore: s.meanAggregated,
    crossEncoderNorm: s.meanCeNorm,
    crossEncoderScore: null,
    usesSystemStats: null,
    matchedStatLlm: null,
    queryCount: s.queryCount,
    response: '',
    id: String(s.rank),
  }))

  const chartPoints = llmSummary.map((s) => ({
    llm: s.llm,
    aggregatedScore: s.meanAggregated,
    crossEncoderNorm: s.meanCeNorm,
    hasSystem: true,
  }))

  const dbStats = getModelStatistics()
  const statModels = Array.isArray(dbStats.models) ? dbStats.models : []
  const modelsWithNumericStat = statModels.filter((m) => effectiveSystemScore(m) != null).length

  return {
    multiQuery: true,
    queryCount: perQuery.length,
    perQuery,
    llmSummary,
    llmLineMeta,
    queryLineData,
    flatRows,
    blendWeight: W,
    crossEncoderMode,
    crossEncoderWarning,
    query: `Combined ${perQuery.length} quer${perQuery.length === 1 ? 'y' : 'ies'}`,
    rows: summaryRows,
    chartPoints,
    systemStatsAvailable: perQuery.some((p) => p.systemStatsAvailable),
    systemStatsDetail: {
      dbBatchCount: perQuery[0]?.systemStatsDetail?.dbBatchCount ?? 0,
      modelsInDb: perQuery[0]?.systemStatsDetail?.modelsInDb ?? 0,
      modelsWithScore: modelsWithNumericStat,
      uploadRowsMatchedSystem: perQuery.reduce((a, p) => a + (p.systemStatsDetail?.uploadRowsMatchedSystem ?? 0), 0),
      blendCrossEncoderWeight: W,
      totalRowsGraded: flatRows.length,
    },
    systemStatsHint:
      perQuery.length > 1
        ? 'Per-query rankings below; summary uses mean aggregated score across all queries for each LLM.'
        : null,
    bestSystemModel: perQuery[0]?.bestSystemModel ?? null,
  }
}

/**
 * @param {{ runs: { query: string, rows: unknown[], sheetName?: string }[] }} payload
 */
async function runMultiQueryTrain(payload) {
  const runsIn = Array.isArray(payload.runs) ? payload.runs : []
  if (runsIn.length === 0) {
    const err = new Error('runs array is required.')
    err.statusCode = 400
    throw err
  }

  const perQuery = []
  let runIndex = 0
  for (const run of runsIn) {
    const query = typeof run.query === 'string' ? run.query.trim() : ''
    const rowsIn = Array.isArray(run.rows) ? run.rows : []
    const sheetName = typeof run.sheetName === 'string' ? run.sheetName : ''

    const normalizedRows = rowsIn.map((r, i) => ({
      id: r.id != null ? String(r.id) : String(i + 1),
      llm: String(r.llm ?? '').trim() || `Model ${i + 1}`,
      response: typeof r.response === 'string' ? r.response : String(r.response ?? ''),
    }))

    const one = await computeSingleTrainingRun({ query, rows: normalizedRows })
    perQuery.push({
      ...one,
      sheetName,
      runIndex,
    })
    runIndex += 1
  }

  return buildMultiQueryResponse(perQuery)
}

/**
 * @param {{ query?: string, rows?: unknown[], runs?: { query: string, rows: unknown[], sheetName?: string }[] }} payload
 */
async function runDatasetTrain(payload) {
  if (Array.isArray(payload.runs) && payload.runs.length > 0) {
    if (payload.runs.length === 1) {
      const r = payload.runs[0]
      return computeSingleTrainingRun({
        query: typeof r.query === 'string' ? r.query : '',
        rows: Array.isArray(r.rows) ? r.rows : [],
      })
    }
    return runMultiQueryTrain(payload)
  }

  return computeSingleTrainingRun({
    query: typeof payload.query === 'string' ? payload.query : '',
    rows: Array.isArray(payload.rows) ? payload.rows : [],
  })
}

module.exports = { runDatasetTrain }
