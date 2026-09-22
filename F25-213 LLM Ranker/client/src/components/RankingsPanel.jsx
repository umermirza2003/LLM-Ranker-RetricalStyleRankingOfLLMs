import { X, Loader2, AlertCircle } from "lucide-react"
import RankedResultsBlock from "./RankedResultsBlock"

/**
 * Desktop rankings column: loading, errors, and response cards (preview ordering).
 * When `hasUserRankPreference` + `originalResults` (from query history), shows score order vs your order.
 */
function RankingsPanel({
  currentQuery,
  batchId,
  loading = false,
  error = null,
  results = null,
  originalResults = null,
  hasUserRankPreference = false,
  scoreSource = undefined,
  onClose,
}) {
  const ranked = Array.isArray(results) ? results : []
  const original = Array.isArray(originalResults) ? originalResults : []
  const showDual =
    Boolean(hasUserRankPreference) && original.length > 0 && ranked.length > 0

  return (
    <div className="rankings-panel-container flex flex-col h-full">
      <div className="rankings-header shrink-0">
        <div className="rankings-header-row">
          <h2 className="section-title">Rankings</h2>
          <div className="rankings-header-actions">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rankings-close-button"
                aria-label="Close rankings panel"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        {currentQuery && (
          <div className="rankings-query-display">
            <div className="rankings-query-label">Query</div>
            <p className="rankings-query-text">{currentQuery}</p>
          </div>
        )}
      </div>

      <div className="rankings-list-container flex-1 min-h-0 overflow-y-auto pr-1">
        {!currentQuery ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-4">
            Submit a query to see model responses here.
          </p>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-gray-600 dark:text-gray-300">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm text-center font-medium">Calling selected models…</p>
          </div>
        ) : error ? (
          <div className="m-3 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/25 dark:border-red-800 flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        ) : ranked.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-4">
            No results yet. Try submitting your query again.
          </p>
        ) : showDual ? (
          <>
            {scoreSource === "placeholder" && (
              <div className="mx-3 mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                CrossEncoder inactive — showing <strong>fixed preview scores</strong> by model order (not based on answer text). Ensure{" "}
                <code className="text-[10px]">rank_transformers_service.py</code> is running and Node can reach port 5056.
              </div>
            )}
            <div className="space-y-8 px-1 pt-2 pb-6">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">
                  Original ranking (preview score)
                </h3>
                <RankedResultsBlock
                  results={original}
                  batchId={undefined}
                  query={currentQuery}
                  className="pt-0"
                />
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2 px-1">
                  Your preferred order
                </h3>
                <RankedResultsBlock
                  results={ranked}
                  batchId={batchId}
                  query={currentQuery}
                  className="pt-0"
                />
              </section>
            </div>
          </>
        ) : (
          <>
            {scoreSource === "placeholder" && (
              <div className="mx-3 mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                CrossEncoder inactive — showing <strong>fixed preview scores</strong> by model order (not based on answer text). Ensure{" "}
                <code className="text-[10px]">rank_transformers_service.py</code> is running and Node can reach port 5056.
              </div>
            )}
            <RankedResultsBlock
              results={ranked}
              batchId={batchId}
              query={currentQuery}
              className="pb-6 pt-2"
            />
          </>
        )}
      </div>
    </div>
  )
}

export default RankingsPanel
