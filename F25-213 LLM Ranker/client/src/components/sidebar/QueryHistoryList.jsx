import { useState, useEffect, useCallback } from "react"
import QueryItem from "./QueryItem"
import { getApiBaseUrl } from "@/lib/apiBase"

const HISTORY_EVENT = "llm-ranker-history-refresh"

/** SQLite `datetime('now')` often omits `T`; normalize for reliable `Date` parsing. */
function toDisplayIso(createdAt) {
  if (createdAt == null) return new Date().toISOString()
  const s = String(createdAt).trim()
  if (!s) return new Date().toISOString()
  if (s.includes("T")) return s
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) return `${s.replace(" ", "T")}Z`
  return s
}

const QueryHistoryList = ({ onQuerySelect }) => {
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [activeQueryId, setActiveQueryId] = useState(null)

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) {
      setFetchError(null)
      setLoading(true)
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/query-history?limit=100`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || `History failed (${res.status})`)
      }
      const batches = Array.isArray(payload.batches) ? payload.batches : []
      setQueries(
        batches.map((b) => ({
          id: b.batchId,
          batchId: b.batchId,
          query: b.query || "",
          date: toDisplayIso(b.created_at),
          llmCount: typeof b.llm_count === "number" ? b.llm_count : Number(b.llm_count) || 0,
          bestLLM: b.best_llm_name ? String(b.best_llm_name) : "",
          responses: [],
        })),
      )
      if (silent) setFetchError(null)
    } catch (err) {
      console.error("[query-history]", err)
      if (!silent) {
        setFetchError(err?.message || "Could not load history.")
        setQueries([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory(false)
    const handler = () => loadHistory(true)
    window.addEventListener(HISTORY_EVENT, handler)
    return () => window.removeEventListener(HISTORY_EVENT, handler)
  }, [loadHistory])

  const handleQueryClick = (queryId) => {
    setActiveQueryId(queryId)
    const selectedQuery = queries.find((q) => q.id === queryId)
    if (selectedQuery && onQuerySelect) {
      onQuerySelect(selectedQuery)
    }
  }

  return (
    <div>
      <h2 className="section-title text-sm mb-4 tracking-tight">
        Query History
      </h2>
      <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            Loading history…
          </p>
        ) : fetchError ? (
          <p className="text-sm text-red-600 dark:text-red-400 text-center py-4">
            {fetchError}
          </p>
        ) : queries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No queries yet. Submit a query to see history.
          </p>
        ) : (
          queries.map((query) => (
            <QueryItem
              key={query.id}
              query={query}
              isActive={activeQueryId === query.id}
              onClick={() => handleQueryClick(query.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default QueryHistoryList
export { HISTORY_EVENT }
