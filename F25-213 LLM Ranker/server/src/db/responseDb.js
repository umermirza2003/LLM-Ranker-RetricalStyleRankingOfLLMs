const fs = require('fs')
const path = require('path')

let Database
try {
  Database = require('better-sqlite3')
} catch {
  Database = null
}

const defaultDir = path.resolve(__dirname, '../../data')
const defaultPath = path.join(defaultDir, 'responses.db')

let db

function getDbPath() {
  const custom = process.env.SQLITE_DB_PATH
  if (custom && String(custom).trim()) {
    const trimmed = String(custom).trim()
    return path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed)
  }
  return defaultPath
}

/** Backfill columns on older SQLite files */
function migrateTableColumns(inst) {
  const colNames = () =>
    new Set(inst.prepare('PRAGMA table_info(llm_responses)').all().map((c) => c.name))

  let names = colNames()
  if (!names.has('batch_id')) {
    try {
      inst.exec(`ALTER TABLE llm_responses ADD COLUMN batch_id TEXT DEFAULT ''`)
    } catch (err) {
      console.warn('[responseDb] batch_id migration:', err.message)
      inst.exec(`ALTER TABLE llm_responses ADD COLUMN batch_id TEXT`)
    }
  }
  names = colNames()
  if (!names.has('score')) {
    inst.exec(`ALTER TABLE llm_responses ADD COLUMN score REAL`)
  }
  names = colNames()
  if (!names.has('score_source')) {
    inst.exec(`ALTER TABLE llm_responses ADD COLUMN score_source TEXT`)
  }
}

function closeDatabase() {
  try {
    if (db) {
      db.close()
      db = null
    }
  } catch (_) {
    /* ignore */
  }
}

/** Opens DB once and applies schema migrations — call on server startup. */
function warmupDatabase() {
  if (!Database) return
  try {
    const d = getDb()
    console.log('[responseDb] SQLite ready:', getDbPath())
    return d
  } catch (e) {
    console.warn('[responseDb] Warmup skipped:', e.message)
  }
  return null
}

function getDb() {
  if (!Database) {
    throw new Error('Run: npm install better-sqlite3 (in server/)')
  }
  if (!db) {
    const dbPath = getDbPath()
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS llm_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        llm_id INTEGER NOT NULL,
        llm_name TEXT NOT NULL,
        response TEXT NOT NULL,
        batch_id TEXT DEFAULT '',
        score REAL,
        score_source TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_llm_responses_query ON llm_responses(query);
      CREATE INDEX IF NOT EXISTS idx_llm_responses_llm_id ON llm_responses(llm_id);
      CREATE INDEX IF NOT EXISTS idx_llm_responses_created ON llm_responses(created_at);
    `)
    migrateTableColumns(db)
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_llm_responses_batch ON llm_responses(batch_id)`)
    } catch {
      /* ignore */
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_rank_preferences (
        batch_id TEXT PRIMARY KEY NOT NULL,
        query TEXT NOT NULL,
        order_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_user_rank_prefs_query ON user_rank_preferences(query);
    `)
  }
  return db
}

/**
 * Persist each model reply for one submit.
 * Score is filled later via saveScoresForBatch.
 */
function persistAggregatedResponses(query, aggregated, batchId) {
  if (!Database) {
    console.warn('[responseDb] better-sqlite3 not installed; skipping SQLite persist.')
    return
  }
  if (!query || typeof query !== 'string' || !query.trim()) return
  const items = Array.isArray(aggregated) ? aggregated : []
  const rows = []
  for (const item of items) {
    const slot = item?.panelSlot
    if (!Number.isFinite(slot) || slot < 1) continue
    const name = typeof item.ai === 'string' && item.ai.trim() ? item.ai.trim() : `Slot ${slot}`
    const resp = typeof item.response === 'string' ? item.response : String(item.response ?? '')
    rows.push({ llm_id: Math.trunc(slot), llm_name: name, response: resp })
  }
  if (rows.length === 0) return

  const batch = typeof batchId === 'string' && batchId.trim() ? batchId.trim() : ''

  try {
    const d = getDb()
    const stmt = d.prepare(
      `INSERT INTO llm_responses (query, llm_id, llm_name, response, batch_id, score, score_source)
       VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
    )
    const insertMany = d.transaction((list) => {
      for (const r of list) {
        stmt.run(query.trim(), r.llm_id, r.llm_name, r.response, batch)
      }
    })
    insertMany(rows)
  } catch (err) {
    console.warn('[responseDb] persist failed:', err.message)
  }
}

/** Remove all stored responses (schema kept). Fallback when DB files cannot be deleted. */
function clearAllLLMResponses() {
  if (!Database) {
    return { ok: false, error: 'better-sqlite3 not installed.' }
  }
  try {
    const d = getDb()
    d.exec('DELETE FROM user_rank_preferences')
    d.exec('DELETE FROM llm_responses')
    try {
      d.exec('VACUUM')
    } catch (vacErr) {
      console.warn('[responseDb] VACUUM after clear skipped:', vacErr.message)
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message || String(err) }
  }
}

/**
 * Write CrossEncoder / placeholder / ask ranker scores for one batch.
 * @param {string} batchId
 * @param {{ llm?: string, ai?: string, score: number }[]} results
 * @param {string} scoreSource e.g. cross_encoder | placeholder | embedding_tfidf
 */
function saveScoresForBatch(batchId, results, scoreSource) {
  if (!Database || !batchId || !Array.isArray(results) || results.length === 0) return
  const src = scoreSource == null ? null : String(scoreSource)
  try {
    const d = getDb()
    const stmt = d.prepare(
      `UPDATE llm_responses SET score = ?, score_source = ? WHERE batch_id = ? AND llm_name = ?`,
    )
    const tx = d.transaction((list) => {
      for (const r of list) {
        const name = (r.llm ?? r.ai ?? '').toString().trim()
        const sc = typeof r.score === 'number' ? r.score : Number(r.score)
        if (!name || !Number.isFinite(sc)) continue
        stmt.run(sc, src, batchId, name)
      }
    })
    tx(results)
  } catch (err) {
    console.warn('[responseDb] saveScoresForBatch failed:', err.message)
  }
}

/** Model names for one batch row-for-row order (handles duplicate display names correctly). */
function getLlmsForBatchMultiset(batchId) {
  const id = typeof batchId === 'string' ? batchId.trim() : ''
  if (!id || !Database) return []
  try {
    const d = getDb()
    const rows = d.prepare(`SELECT llm_name FROM llm_responses WHERE batch_id = ? ORDER BY id ASC`).all(id)
    return rows.map((r) => String(r.llm_name ?? '').trim())
  } catch (_) {
    return []
  }
}

function nameMultisetEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  const count = (arr) => {
    const m = new Map()
    for (const name of arr) {
      const k = String(name ?? '').trim()
      if (!k) continue
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }
  const ma = count(a)
  const mb = count(b)
  if (ma.size !== mb.size) return false
  for (const [k, v] of ma) {
    if (mb.get(k) !== v) return false
  }
  return true
}

/**
 * Parses stored JSON array of model names.
 * @param {string} batchId
 * @returns {string[]}
 */
function getUserRankOrderParsed(batchId) {
  const id = typeof batchId === 'string' ? batchId.trim() : ''
  if (!id || !Database) return []
  try {
    const d = getDb()
    const row = d
      .prepare(`SELECT order_json FROM user_rank_preferences WHERE batch_id = ?`)
      .get(id)
    if (!row || typeof row.order_json !== 'string') return []
    const parsed = JSON.parse(row.order_json)
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x ?? '').trim()).filter(Boolean)
      : []
  } catch (_) {
    return []
  }
}

/**
 * Reorder `{ llm }[]` rows to match a saved preference (handles duplicate llm strings left-to-right).
 * @returns {unknown[]}
 */
function reorderResultsByUserPreference(batchId, results) {
  if (
    !Database ||
    typeof batchId !== 'string' ||
    !batchId.trim() ||
    !Array.isArray(results) ||
    results.length === 0
  ) {
    return results
  }
  const prefs = getUserRankOrderParsed(batchId)
  if (!prefs.length) return results

  const pool = [...results]
  const out = []
  for (const name of prefs) {
    const idx = pool.findIndex((r) => String(r?.llm ?? r?.ai ?? '').trim() === name)
    if (idx >= 0) {
      out.push(pool[idx])
      pool.splice(idx, 1)
    }
  }
  out.push(...pool)
  return out
}

/**
 * Persist user-defined ranking for one batch (`INSERT OR REPLACE`).
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function saveUserRankPreference(batchId, query, orderedLlms) {
  if (!Database) {
    return { ok: false, error: 'SQLite not available.' }
  }
  const id = typeof batchId === 'string' ? batchId.trim() : ''
  const q = typeof query === 'string' ? query.trim() : ''
  if (!id || !q) {
    return { ok: false, error: 'batchId and query are required.' }
  }
  if (!Array.isArray(orderedLlms) || orderedLlms.length === 0) {
    return { ok: false, error: 'orderedLlms must be a non-empty array.' }
  }

  const expected = getLlmsForBatchMultiset(id)
  const got = orderedLlms.map((x) => String(x ?? '').trim()).filter(Boolean)

  if (expected.length === 0) {
    return { ok: false, error: 'No responses found for this batch.' }
  }
  if (!nameMultisetEqual(expected, got)) {
    return { ok: false, error: 'Order must include each model reply exactly once (same multiset as saved batch).' }
  }

  try {
    const d = getDb()
    d.prepare(
      `INSERT INTO user_rank_preferences (batch_id, query, order_json, created_at)
       VALUES (@batchId, @query, @json, datetime('now'))
       ON CONFLICT(batch_id) DO UPDATE SET
         query = excluded.query,
         order_json = excluded.order_json,
         created_at = excluded.created_at`,
    ).run({
      batchId: id,
      query: q,
      json: JSON.stringify(got),
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message || 'Save failed.' }
  }
}

/** LLM names in preview-score order (matches `originalResults` / batch detail canon). */
function getCanonicalRankOrderForBatch(batchId) {
  const id = typeof batchId === 'string' ? batchId.trim() : ''
  if (!id || !Database) return []
  try {
    const d = getDb()
    const rows = d
      .prepare(
        `SELECT llm_name FROM llm_responses WHERE batch_id = ?
         ORDER BY (score IS NULL), score DESC, id ASC`,
      )
      .all(id)
    return rows.map((r) => String(r.llm_name ?? '').trim()).filter(Boolean)
  } catch (_) {
    return []
  }
}

function userRankPreferenceRowExists(batchId) {
  const id = typeof batchId === 'string' ? batchId.trim() : ''
  if (!id || !Database) return false
  try {
    const d = getDb()
    const row = d.prepare(`SELECT 1 FROM user_rank_preferences WHERE batch_id = ?`).get(id)
    return Boolean(row)
  } catch (_) {
    return false
  }
}

/**
 * If there is no row in `user_rank_preferences` yet, insert the score-based order.
 * That way “human preferred” is always persisted; when the user never reorders it matches the original ranking.
 * @returns {{ ok: boolean, seeded?: boolean, error?: string }}
 */
function ensureDefaultUserRankPreference(batchId, query) {
  if (!Database) {
    return { ok: false, error: 'SQLite not available.', seeded: false }
  }
  const id = typeof batchId === 'string' ? batchId.trim() : ''
  const q = typeof query === 'string' ? query.trim() : ''
  if (!id || !q) {
    return { ok: false, error: 'batchId and query are required.', seeded: false }
  }
  if (userRankPreferenceRowExists(id)) {
    return { ok: true, seeded: false }
  }
  const ordered = getCanonicalRankOrderForBatch(id)
  if (ordered.length === 0) {
    return { ok: false, error: 'No responses for batch.', seeded: false }
  }
  const res = saveUserRankPreference(id, q, ordered)
  return res.ok ? { ok: true, seeded: true } : { ok: false, error: res.error, seeded: false }
}

/** Same order as stored prefs (for comparing to canonical list). */
function preferenceOrderMatchesCanon(prefs, canonLlms) {
  if (!Array.isArray(prefs) || !Array.isArray(canonLlms)) return true
  if (prefs.length !== canonLlms.length) return false
  for (let i = 0; i < prefs.length; i++) {
    if (String(prefs[i] ?? '').trim() !== String(canonLlms[i] ?? '').trim()) return false
  }
  return true
}

/**
 * One row per persisted rank batch (newest first). Requires non-empty batch_id.
 * @param {number} limit
 * @returns {{
 *   batchId: string,
 *   query: string,
 *   created_at: string,
 *   llm_count: number,
 *   best_llm_name: string | null,
 *   score_source: string | null
 * }[]}
 */
function listQueryHistoryBatches(limit = 80) {
  if (!Database) return []
  const lim = typeof limit === 'number' && limit > 0 ? Math.floor(limit) : 80
  try {
    const d = getDb()
    const stmt = d.prepare(
      `SELECT
          r.batch_id AS batch_id,
          MAX(r.query) AS query,
          MAX(r.created_at) AS created_at,
          COUNT(*) AS llm_count,
          (SELECT r2.llm_name FROM llm_responses AS r2
           WHERE r2.batch_id = r.batch_id
           ORDER BY (r2.score IS NULL), r2.score DESC, r2.id ASC
           LIMIT 1) AS best_llm_name,
          (SELECT r3.score_source FROM llm_responses AS r3
           WHERE r3.batch_id = r.batch_id
             AND r3.score_source IS NOT NULL
             AND TRIM(r3.score_source) <> ''
           LIMIT 1) AS score_source
       FROM llm_responses AS r
       WHERE r.batch_id IS NOT NULL AND TRIM(r.batch_id) <> ''
       GROUP BY r.batch_id
       ORDER BY MAX(r.created_at) DESC
       LIMIT ?`,
    )
    const rows = stmt.all(lim)
    return rows.map((row) => ({
      batchId: row.batch_id,
      query: row.query,
      created_at: row.created_at,
      llm_count: row.llm_count,
      best_llm_name: row.best_llm_name ?? null,
      score_source: row.score_source ?? null,
    }))
  } catch (err) {
    console.warn('[responseDb] listQueryHistoryBatches failed:', err.message)
    return []
  }
}

/**
 * @returns {null | {
 *   batchId: string,
 *   query: string,
 *   scoreSource: string | undefined,
 *   originalResults: { llm: string, response: string, score: number|null }[],
 *   hasUserRankPreference: boolean — true only if stored order differs from preview-score (canonical) order,
 *   results: { llm: string, response: string, score: number|null }[],
 * }}
 */
function getQueryHistoryBatchDetail(batchId) {
  if (!Database || typeof batchId !== 'string' || !batchId.trim()) return null
  const id = batchId.trim()
  try {
    const d = getDb()
    const rows = d
      .prepare(
        `SELECT llm_name, response, score, score_source, query
         FROM llm_responses
         WHERE batch_id = ?
         ORDER BY (score IS NULL), score DESC, id ASC`,
      )
      .all(id)
    if (!rows.length) return null
    const foundSrc = rows.find((r) => r.score_source && String(r.score_source).trim())
    const normalizedSource =
      typeof foundSrc?.score_source === 'string' && foundSrc.score_source.trim()
        ? foundSrc.score_source.trim()
        : undefined
    const canon = rows.map((r) => ({
      llm: r.llm_name,
      response: typeof r.response === 'string' ? r.response : String(r.response ?? ''),
      score: r.score == null ? null : Number(r.score),
    }))
    const canonLlms = canon.map((r) => r.llm)
    const prefs = getUserRankOrderParsed(id)
    /** True only when a stored preference differs from preview-score order (custom reorder). Default seed matches canon → false. */
    const hasUserRankPreference =
      prefs.length > 0 && !preferenceOrderMatchesCanon(prefs, canonLlms)
    return {
      batchId: id,
      query: rows[0].query,
      scoreSource: normalizedSource,
      originalResults: canon,
      hasUserRankPreference,
      results: reorderResultsByUserPreference(id, canon),
    }
  } catch (err) {
    console.warn('[responseDb] getQueryHistoryBatchDetail failed:', err.message)
    return null
  }
}

/**
 * Preferred order for stats: saved user order, else canonical score order.
 * @param {string} batchId
 * @returns {string[]}
 */
function getPreferredOrderForStatistics(batchId) {
  const prefs = getUserRankOrderParsed(batchId)
  if (prefs.length > 0) return prefs
  return getCanonicalRankOrderForBatch(batchId)
}

/**
 * Cross-batch stats: preview-score mean, normalized rank-score mean (by user-preferred order),
 * combined = avgPreview + avgRank; best model = most often rank #1, then highest combined.
 * @returns {{
 *   batchCount: number,
 *   models: Array<{
 *     llm: string,
 *     avgPreviewScore: number | null,
 *     avgRankScore: number | null,
 *     combinedScore: number | null,
 *     timesRankedFirst: number,
 *     queriesWithModel: number,
 *     previewRowCount: number,
 *   }>,
 *   bestModel: object | null,
 * }}
 */
function getModelStatistics() {
  if (!Database) {
    return { batchCount: 0, models: [], bestModel: null }
  }
  try {
    const d = getDb()
    const batchRows = d
      .prepare(
        `SELECT DISTINCT batch_id FROM llm_responses
         WHERE batch_id IS NOT NULL AND TRIM(batch_id) <> ''`,
      )
      .all()
    const batchIds = batchRows.map((r) => String(r.batch_id).trim()).filter(Boolean)

    /** @type {Map<string, { rankSum: number, batchCount: number, firstCount: number }>} */
    const rankAgg = new Map()

    for (const bid of batchIds) {
      const order = getPreferredOrderForStatistics(bid)
      const n = order.length
      if (n === 0) continue

      order.forEach((name, idx) => {
        const llm = String(name ?? '').trim()
        if (!llm) return
        const rank = idx + 1
        const rankScore = (n - rank + 1) / n
        let rec = rankAgg.get(llm)
        if (!rec) {
          rec = { rankSum: 0, batchCount: 0, firstCount: 0 }
          rankAgg.set(llm, rec)
        }
        rec.rankSum += rankScore
        rec.batchCount += 1
        if (rank === 1) rec.firstCount += 1
      })
    }

    const avgRows = d
      .prepare(
        `SELECT llm_name AS llm,
                AVG(score) AS avg_preview,
                COUNT(*) AS row_count
         FROM llm_responses
         WHERE batch_id IS NOT NULL AND TRIM(batch_id) <> ''
           AND score IS NOT NULL
         GROUP BY llm_name`,
      )
      .all()

    /** @type {Map<string, { avgPreview: number, rowCount: number }>} */
    const previewAgg = new Map()
    for (const row of avgRows) {
      const llm = String(row.llm ?? '').trim()
      if (!llm) continue
      previewAgg.set(llm, {
        avgPreview: Number(row.avg_preview),
        rowCount: Number(row.row_count),
      })
    }

    const names = new Set([...rankAgg.keys(), ...previewAgg.keys()])
    const models = []

    for (const llm of names) {
      const r = rankAgg.get(llm)
      const p = previewAgg.get(llm)
      const avgPreviewScore =
        p && Number.isFinite(p.avgPreview) ? p.avgPreview : null
      const avgRankScore =
        r && r.batchCount > 0 ? r.rankSum / r.batchCount : null

      let combinedScore = null
      if (avgPreviewScore != null && avgRankScore != null) {
        combinedScore = avgPreviewScore + avgRankScore
      } else if (avgPreviewScore != null) {
        combinedScore = avgPreviewScore
      } else if (avgRankScore != null) {
        combinedScore = avgRankScore
      }

      models.push({
        llm,
        avgPreviewScore,
        avgRankScore,
        combinedScore,
        timesRankedFirst: r ? r.firstCount : 0,
        queriesWithModel: r ? r.batchCount : 0,
        previewRowCount: p ? p.rowCount : 0,
      })
    }

    models.sort((x, y) => {
      if (y.timesRankedFirst !== x.timesRankedFirst) return y.timesRankedFirst - x.timesRankedFirst
      const csy = y.combinedScore ?? -Infinity
      const csx = x.combinedScore ?? -Infinity
      if (csy !== csx) return csy - csx
      return String(x.llm).localeCompare(String(y.llm))
    })

    const bestModel = models.length > 0 ? models[0] : null

    return {
      batchCount: batchIds.length,
      models,
      bestModel,
    }
  } catch (err) {
    console.warn('[responseDb] getModelStatistics failed:', err.message)
    return { batchCount: 0, models: [], bestModel: null }
  }
}

/**
 * Dashboard overview from SQLite (same store as query history / rankings).
 * @returns {{
 *   totalBatches: number,
 *   maxPreviewScore: number | null,
 *   distinctLlmCount: number,
 *   recentComparisons: Array<{ batchId: string, query: string, created_at: string, llm_count: number, best_llm_name: string | null }>,
 * }}
 */
function getDashboardSummary() {
  if (!Database) {
    return {
      totalBatches: 0,
      maxPreviewScore: null,
      distinctLlmCount: 0,
      recentComparisons: [],
    }
  }
  try {
    const d = getDb()
    const cnt = d
      .prepare(
        `SELECT COUNT(DISTINCT batch_id) AS c FROM llm_responses
         WHERE batch_id IS NOT NULL AND TRIM(batch_id) <> ''`,
      )
      .get()
    const totalBatches = Number(cnt?.c) || 0

    const mx = d.prepare(`SELECT MAX(score) AS m FROM llm_responses WHERE score IS NOT NULL`).get()
    const maxPreviewScore = mx?.m != null && Number.isFinite(Number(mx.m)) ? Number(mx.m) : null

    const dist = d.prepare(`SELECT COUNT(DISTINCT llm_name) AS c FROM llm_responses`).get()
    const distinctLlmCount = Number(dist?.c) || 0

    const batches = listQueryHistoryBatches(12)
    const recentComparisons = batches.map((b) => ({
      batchId: b.batchId,
      query: typeof b.query === 'string' ? b.query : '',
      created_at: b.created_at,
      llm_count: b.llm_count,
      best_llm_name: b.best_llm_name ?? null,
    }))

    return {
      totalBatches,
      maxPreviewScore,
      distinctLlmCount,
      recentComparisons,
    }
  } catch (err) {
    console.warn('[responseDb] getDashboardSummary failed:', err.message)
    return {
      totalBatches: 0,
      maxPreviewScore: null,
      distinctLlmCount: 0,
      recentComparisons: [],
    }
  }
}

module.exports = {
  getDb,
  getDbPath,
  persistAggregatedResponses,
  saveScoresForBatch,
  clearAllLLMResponses,
  reorderResultsByUserPreference,
  saveUserRankPreference,
  ensureDefaultUserRankPreference,
  listQueryHistoryBatches,
  getQueryHistoryBatchDetail,
  getModelStatistics,
  getDashboardSummary,
  warmupDatabase,
  closeDatabase,
}
