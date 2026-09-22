import { useState, useEffect, useCallback, useRef } from "react"
import Sidebar from "../components/Sidebar"
import MainContent from "../components/MainContent"
import RankingsPanel from "../components/RankingsPanel"
import { getApiBaseUrl } from "@/lib/apiBase"

function loadSelectedModelsFromStorage() {
  try {
    const raw = localStorage.getItem("llm-ranker-selected-models")
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const HomePage = () => {
  const [selectedModels, setSelectedModelsState] = useState(loadSelectedModelsFromStorage)

  const setSelectedModels = useCallback((updater) => {
    setSelectedModelsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      localStorage.setItem("llm-ranker-selected-models", JSON.stringify(next))
      return next
    })
  }, [])

  // Load persisted state from localStorage
  const loadPersistedState = () => {
    const saved = localStorage.getItem("llm-ranker-rankings-panel-state")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          currentQuery: parsed.currentQuery || "",
          showRankingsPanel: parsed.showRankingsPanel || false
        }
      } catch (e) {
        console.error("Error loading persisted rankings panel state:", e)
      }
    }
    return { currentQuery: "", showRankingsPanel: false }
  }

  const persistedState = loadPersistedState()
  const [selectedQuery, setSelectedQuery] = useState(null)
  const [currentQuery, setCurrentQuery] = useState(persistedState.currentQuery)
  const [showRankingsPanel, setShowRankingsPanel] = useState(persistedState.showRankingsPanel)

  /** Latest rank preview session for right panel (+ mobile duplicate in MainContent). */
  const [rankingUi, setRankingUi] = useState({
    loading: false,
    error: null,
    snapshot: null,
  })

  const historyFetchAbortRef = useRef(null)

  /** Sidebar/history selection aligns snapshot to panel when batch ids match (query text can differ slightly). */
  const panelUsesSnapshot = useCallback((snapshot) => {
    if (!snapshot) return false
    if (selectedQuery) {
      const want = String(selectedQuery.batchId ?? selectedQuery.id ?? "").trim()
      const have = String(snapshot.batchId ?? "").trim()
      if (want && have) return want === have
    }
    const cq = String(currentQuery ?? "")
      .trim()
      .replace(/\s+/g, " ")
    const sq = String(snapshot.query ?? "")
      .trim()
      .replace(/\s+/g, " ")
    return cq.length > 0 && cq === sq
  }, [selectedQuery, currentQuery])

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("llm-ranker-rankings-panel-state", JSON.stringify({
      currentQuery,
      showRankingsPanel
    }))
  }, [currentQuery, showRankingsPanel])

  const handleQuerySelect = (query) => {
    setSelectedQuery(query)
    if (!query?.query || !query.query.trim()) {
      setRankingUi({ loading: false, error: null, snapshot: null })
      return
    }

    setCurrentQuery(query.query.trim())
    setShowRankingsPanel(true)

    const rows = Array.isArray(query.responses) ? query.responses : []
    if (rows.length > 0) {
      const bid =
        typeof query.batchId === "string" && query.batchId.trim()
          ? query.batchId.trim()
          : typeof query.id === "string" && query.id.trim()
            ? query.id.trim()
            : undefined
      setRankingUi({
        loading: false,
        error: null,
        snapshot: {
          query: query.query.trim(),
          ...(bid ? { batchId: bid } : {}),
          scoreSource: query.scoreSource,
          results: rows.map((r) => ({
            llm: r.model || r.llm || "Model",
            response: typeof r.response === "string" ? r.response : "",
            score: typeof r.score === "number" ? r.score : Number(r.score) || 0,
          })),
        },
      })
      return
    }

    const batchId =
      typeof query.batchId === "string" && query.batchId.trim()
        ? query.batchId.trim()
        : typeof query.id === "string" && query.id.trim()
          ? query.id.trim()
          : ""

    if (!batchId) {
      setRankingUi({ loading: false, error: null, snapshot: null })
      return
    }

    historyFetchAbortRef.current?.abort()
    const ac = new AbortController()
    historyFetchAbortRef.current = ac

    setRankingUi({ loading: true, error: null, snapshot: null })
    ;(async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/query-history/${encodeURIComponent(batchId)}`,
          { signal: ac.signal },
        )
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(payload.error || `Could not load batch (${res.status})`)
        }
        const list = Array.isArray(payload.results) ? payload.results : []
        const orig = Array.isArray(payload.originalResults) ? payload.originalResults : null
        setRankingUi({
          loading: false,
          error: null,
          snapshot: {
            query: (payload.query || query.query).trim(),
            batchId: payload.batchId ?? batchId,
            results: list,
            originalResults: orig,
            hasUserRankPreference: Boolean(payload.hasUserRankPreference),
            scoreSource: payload.scoreSource,
          },
        })
      } catch (e) {
        if (e?.name === "AbortError") return
        setRankingUi({
          loading: false,
          error: e?.message || "Could not load rankings for this query.",
          snapshot: null,
        })
      }
    })()
  }

  const handleQuerySubmit = (queryText) => {
    if (queryText && queryText.trim()) {
      setCurrentQuery(queryText.trim())
      setShowRankingsPanel(true)
    }
  }

  const handleRankingStart = useCallback((queryText) => {
    const trimmed = typeof queryText === "string" ? queryText.trim() : ""
    if (!trimmed) return
    historyFetchAbortRef.current?.abort()
    setSelectedQuery(null)
    setCurrentQuery(trimmed)
    setShowRankingsPanel(true)
    setRankingUi({ loading: true, error: null, snapshot: null })
  }, [])

  const handleRankingSuccess = useCallback((payload) => {
    setRankingUi({ loading: false, error: null, snapshot: payload })
  }, [])

  const handleRankingFailure = useCallback((message) => {
    setRankingUi((prev) => ({
      ...prev,
      loading: false,
      error: typeof message === "string" ? message : "Request failed.",
    }))
  }, [])

  const handleCloseRankings = () => {
    historyFetchAbortRef.current?.abort()
    setShowRankingsPanel(false)
    setCurrentQuery("")
    setSelectedQuery(null)
    setRankingUi({ loading: false, error: null, snapshot: null })
    localStorage.removeItem("llm-ranker-rankings-panel-state")
  }

  const snapshotAligned = panelUsesSnapshot(rankingUi.snapshot)

  return (
    <div className="full-height-container">
      {/* Left Sidebar */}
      <Sidebar
        onQuerySelect={handleQuerySelect}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
      />

      {/* Main Content Area */}
      <MainContent
        selectedQuery={selectedQuery}
        onQueryDeselect={() => setSelectedQuery(null)}
        onQuerySubmit={handleQuerySubmit}
        selectedModels={selectedModels}
        onRankingStart={handleRankingStart}
        onRankingSuccess={handleRankingSuccess}
        onRankingFailure={handleRankingFailure}
        rankingBatchId={rankingUi.snapshot?.batchId}
        rankingSnapshot={rankingUi.snapshot}
        rankingOriginalResults={rankingUi.snapshot?.originalResults}
        rankingHasUserRankPreference={rankingUi.snapshot?.hasUserRankPreference}
        rankingScoreSource={rankingUi.snapshot?.scoreSource}
        rankingLoading={rankingUi.loading}
        rankingError={rankingUi.error}
        activeRankQuery={currentQuery}
      />

      {/* Right Rankings Panel - Only show when explicitly opened */}
      {showRankingsPanel && currentQuery && (
        <div className="hidden lg:block">
          <RankingsPanel
            currentQuery={currentQuery}
            batchId={snapshotAligned ? rankingUi.snapshot?.batchId : undefined}
            loading={rankingUi.loading}
            error={rankingUi.error}
            results={snapshotAligned ? rankingUi.snapshot?.results : null}
            originalResults={snapshotAligned ? rankingUi.snapshot?.originalResults : null}
            hasUserRankPreference={
              snapshotAligned ? rankingUi.snapshot?.hasUserRankPreference : false
            }
            scoreSource={snapshotAligned ? rankingUi.snapshot?.scoreSource : undefined}
            onClose={handleCloseRankings}
          />
        </div>
      )}
    </div>
  )
}

export default HomePage

