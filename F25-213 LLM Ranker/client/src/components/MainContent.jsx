import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Settings, Menu, X, Home, LayoutDashboard, User, LogOut, CheckCircle2, Sparkles, ArrowUpDown, Filter, Loader2, AlertCircle, BarChart3 } from "lucide-react"
import { Button } from "./ui/button"
import Avatar from "./ui/Avatar"
import SearchBar from "./SearchBar"
import UploadBox from "./UploadBox"
import TrainingResultsModal from "./TrainingResultsModal"
import RankedResultsBlock from "./RankedResultsBlock"
import { useAuth } from "../contexts/AuthContext"
import { cn } from "@/lib/utils"
import { getApiBaseUrl } from "@/lib/apiBase"
import { postDatasetTrain as postDatasetTrainRequest } from "@/lib/datasetTrainApi"
import { HISTORY_EVENT } from "./sidebar/QueryHistoryList"

function formatResponseScore(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return "—"
  if (n >= 0 && n <= 1 && n !== Math.floor(n)) return `${(n * 100).toFixed(1)}%`
  return n.toFixed(4)
}

/** API / RankedResultsBlock shape → detail cards */
function snapshotToRows(results) {
  if (!Array.isArray(results)) return []
  return results.map((r, i) => ({
    model: r.llm || r.model || "Model",
    response: typeof r.response === "string" ? r.response : "",
    score: typeof r.score === "number" ? r.score : Number(r.score) || 0,
    rank: i + 1,
  }))
}

function normalizeLegacyResponses(responses) {
  if (!Array.isArray(responses)) return []
  return responses.map((r, i) => ({
    model: r.llm || r.model || "Model",
    response: typeof r.response === "string" ? r.response : "",
    score: typeof r.score === "number" ? r.score : Number(r.score) || 0,
    rank: typeof r.rank === "number" ? r.rank : i + 1,
  }))
}

/** Same filter + sort for both history panels; ties keep source order */
function applyFilterSort(rows, filterModel, sortBy) {
  const filtered = rows
    .map((r, idx) => ({ ...r, _origIdx: idx }))
    .filter((r) => filterModel === "all" || r.model === filterModel)
  filtered.sort((a, b) => {
    const sa = Number(a.score)
    const sb = Number(b.score)
    if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) {
      return sortBy === "highToLow" ? sb - sa : sa - sb
    }
    return a._origIdx - b._origIdx
  })
  return filtered.map(({ _origIdx, ...r }, i) => ({ ...r, rank: i + 1 }))
}

/** Filter only — keeps API array order (saved user preference), not score order */
function applyFilterPreserveOrder(rows, filterModel) {
  const filtered = rows.filter((r) => filterModel === "all" || r.model === filterModel)
  return filtered.map((r, i) => ({ ...r, rank: i + 1 }))
}

const MainContent = ({
  selectedQuery,
  onQueryDeselect,
  onQuerySubmit,
  selectedModels = [],
  onRankingStart,
  onRankingSuccess,
  onRankingFailure,
  rankingBatchId,
  rankingSnapshot = null,
  rankingOriginalResults = null,
  rankingHasUserRankPreference = false,
  rankingScoreSource = undefined,
  rankingLoading = false,
  rankingError = null,
  activeRankQuery = "",
}) => {
  const [query, setQuery] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [querySubmitted, setQuerySubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [sortBy, setSortBy] = useState("highToLow") // highToLow, lowToHigh
  const [filterModel, setFilterModel] = useState("all")
  /** Valid training CSV/XLSX from UploadBox; Train stays disabled until set */
  const [trainingDataset, setTrainingDataset] = useState(null)
  /** Last successful /api/dataset-train payload */
  const [trainingResult, setTrainingResult] = useState(null)
  const [trainLoading, setTrainLoading] = useState(false)
  const [trainError, setTrainError] = useState(null)
  const [resultsModalOpen, setResultsModalOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const normQ = (q) => String(q ?? "").trim().replace(/\s+/g, " ")

  const selectedBatchKey = selectedQuery
    ? String(selectedQuery.batchId ?? selectedQuery.id ?? "").trim()
    : ""
  const snapshotBatchKey = rankingSnapshot ? String(rankingSnapshot.batchId ?? "").trim() : ""

  /** History: prefer batch id match (API vs sidebar query text can differ). Live rank: no sidebar selection — match active query. */
  let snapshotMatches = false
  if (rankingSnapshot) {
    if (selectedQuery) {
      if (selectedBatchKey && snapshotBatchKey) {
        snapshotMatches = selectedBatchKey === snapshotBatchKey
      } else {
        snapshotMatches = normQ(selectedQuery.query) === normQ(rankingSnapshot.query)
      }
    } else if (activeRankQuery) {
      snapshotMatches = normQ(rankingSnapshot.query) === normQ(activeRankQuery)
    }
  }

  const hasInlineResponses =
    Boolean(selectedQuery) &&
    Array.isArray(selectedQuery.responses) &&
    selectedQuery.responses.length > 0

  const originalList = rankingOriginalResults ?? rankingSnapshot?.originalResults ?? null

  const showDualPanels =
    snapshotMatches &&
    rankingHasUserRankPreference &&
    Array.isArray(originalList) &&
    originalList.length > 0 &&
    Array.isArray(rankingSnapshot?.results) &&
    rankingSnapshot.results.length > 0

  const waitingForHistoryFetch =
    Boolean(selectedQuery) &&
    !hasInlineResponses &&
    rankingLoading &&
    !(snapshotMatches && Array.isArray(rankingSnapshot?.results) && rankingSnapshot.results.length > 0)

  const historyFetchFailed =
    Boolean(selectedQuery) &&
    !hasInlineResponses &&
    rankingError &&
    !snapshotMatches

  let preferredRaw = []
  if (snapshotMatches && Array.isArray(rankingSnapshot?.results)) {
    preferredRaw = snapshotToRows(rankingSnapshot.results)
  } else if (hasInlineResponses) {
    preferredRaw = normalizeLegacyResponses(selectedQuery.responses)
  }

  const originalRaw = showDualPanels ? snapshotToRows(originalList) : []

  const modelOptionsSource = showDualPanels ? [...preferredRaw, ...originalRaw] : preferredRaw
  const filterModelOptions = [...new Set(modelOptionsSource.map((r) => r.model))]

  const preservePreferredOrder =
    rankingHasUserRankPreference &&
    snapshotMatches &&
    Array.isArray(rankingSnapshot?.results) &&
    preferredRaw.length > 0

  const preferredDisplay = preservePreferredOrder
    ? applyFilterPreserveOrder(preferredRaw, filterModel)
    : applyFilterSort(preferredRaw, filterModel, sortBy)
  const originalDisplay = showDualPanels ? applyFilterSort(originalRaw, filterModel, sortBy) : []

  const renderHistoryCardList = (rows) => {
    if (!rows.length) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center rounded-lg border border-dashed border-gray-200 dark:border-gray-600">
          No models match this filter.
        </p>
      )
    }
    return rows.map((response, index) => (
      <div
        key={`${response.model}-${index}`}
        className="p-5 bg-white dark:bg-[#1e293b] rounded-lg border border-gray-200 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                response.rank === 1
                  ? "bg-yellow-500 dark:bg-yellow-600 text-white"
                  : response.rank === 2
                    ? "bg-gray-400 dark:bg-gray-500 text-white"
                    : response.rank === 3
                      ? "bg-orange-600 dark:bg-orange-700 text-white"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200",
              )}
            >
              #{response.rank}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{response.model}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-mono">
                  Score: {formatResponseScore(response.score)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{response.response}</p>
      </div>
    ))
  }

  const handleTrainingDataChange = (payload) => {
    setTrainingDataset(payload)
    if (!payload) {
      setTrainingResult(null)
      setTrainError(null)
    }
  }

  const trainingReady =
    Boolean(trainingDataset) &&
    (trainingDataset.multiQuery === true
      ? Array.isArray(trainingDataset.runs) && trainingDataset.runs.length > 0
      : Array.isArray(trainingDataset.rows) && trainingDataset.rows.length > 0)

  const handleTrain = async () => {
    if (!trainingReady) return
    setTrainLoading(true)
    setTrainError(null)
    try {
      const body =
        trainingDataset.multiQuery === true
          ? { runs: trainingDataset.runs }
          : { query: trainingDataset.query, rows: trainingDataset.rows }
      const { res, rawText } = await postDatasetTrainRequest(body)
      let payload = {}
      try {
        payload = rawText ? JSON.parse(rawText) : {}
      } catch {
        throw new Error(
          rawText?.trim()?.slice(0, 200) || `Server returned non-JSON (${res.status})`,
        )
      }
      if (!res.ok) {
        throw new Error(
          payload.error || `Training failed (${res.status})`,
        )
      }
      setTrainingResult(payload)
    } catch (e) {
      let msg = e?.message || "Training request failed."
      if (msg === "Failed to fetch") {
        msg =
          "Cannot reach the API — start the Node server (and use dev proxy or set VITE_API_BASE_URL)."
      }
      setTrainError(msg)
      setTrainingResult(null)
      console.error("[dataset-train]", msg)
    } finally {
      setTrainLoading(false)
    }
  }

  const handleResults = () => {
    if (!trainingResult?.rows?.length) {
      setTrainError("Run Train first to generate results.")
      setTimeout(() => setTrainError(null), 5000)
      return
    }
    setResultsModalOpen(true)
  }

  const handleQuerySubmit = async () => {
    if (!query.trim() || isProcessing) return

    if (!Array.isArray(selectedModels) || selectedModels.length === 0) {
      setQuerySubmitted(true)
      setSubmitError("Please select at least one AI model.")
      setTimeout(() => {
        setQuerySubmitted(false)
      }, 4500)
      return
    }

    setIsProcessing(true)
    setQuerySubmitted(true)
    setSubmitError(null)
    const q = query.trim()
    onRankingStart?.(q)

    try {
      const res = await fetch(`${getApiBaseUrl()}/rank-responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          models: selectedModels,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || `Request failed (${res.status})`)
      }

      const results = Array.isArray(payload.results) ? payload.results : []

      onRankingSuccess?.({
        query: payload.query || q,
        batchId: typeof payload.batchId === "string" ? payload.batchId : undefined,
        results,
        scoreSource:
          typeof payload.scoreSource === "string" && payload.scoreSource.trim()
            ? payload.scoreSource.trim()
            : "placeholder",
      })

      window.dispatchEvent(new CustomEvent(HISTORY_EVENT))

      onQuerySubmit?.(q)
      setTimeout(() => {
        setQuerySubmitted(false)
        setQuery("")
      }, 1800)
    } catch (e) {
      const message = e?.message || "Something went wrong"
      console.error("[rank-responses]", message)
      setSubmitError(message)
      onRankingFailure?.(message)
      setTimeout(() => setQuerySubmitted(false), 5000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProfileClick = () => {
    navigate("/profile")
  }

  const handleLogout = () => {
    logout()
    navigate("/", { replace: true })
  }

  const menuItems = [
    { path: "/home", icon: Home, label: "Home" },
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/model-statistics", icon: BarChart3, label: "Model statistics" },
    { path: "/profile", icon: User, label: "Profile" },
  ]

  return (
    <div className="main-content-container">
      {/* Header */}
      <div className="header-container">
        <div className="header-content-row">
          {/* Hamburger Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="icon-button-large group"
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
            )}
          </button>
          <h1 className="header-title-large">LLM RANKER</h1>
        </div>
        <button 
          onClick={handleProfileClick}
          className="icon-button"
        >
          <Avatar src={user?.avatar} alt={user?.name || "User"} size="md" />
        </button>
      </div>

      {/* Navigation Menu Drawer */}
      {menuOpen && (
        <>
          {/* Overlay */}
          <div
            className="menu-overlay-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          {/* Menu Drawer */}
          <div className="menu-drawer">
            {/* User Info */}
            {user && (
              <div className="sidebar-user-section">
                <div className="user-info-row">
                  <div className="user-avatar-container">
                    <Avatar src={user?.avatar} alt={user?.name || "User"} size="md" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="user-name-text dark:text-gray-100">{user?.name || "User"}</p>
                    <p className="user-email-text dark:text-gray-400">{user?.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Items */}
            <nav className="navigation-container">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path)
                      setMenuOpen(false)
                    }}
                    className={cn(
                      "navigation-item-base w-full",
                      isActive 
                        ? "navigation-item-active" 
                        : "navigation-item-inactive dark:text-gray-300 dark:hover:bg-gray-700"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Logout */}
            {user && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="button-full-width justify-start dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className={cn(
            "mx-auto space-y-6",
            selectedQuery && showDualPanels ? "max-w-7xl" : "max-w-4xl",
          )}
        >
          {/* Query Details Display */}
          {selectedQuery ? (
            <div className="space-y-4">
              {/* Query Header */}
              <div className="p-4 bg-white dark:bg-[#1e293b] rounded-lg border border-gray-200 dark:border-gray-700/50 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {selectedQuery.query}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>{new Date(selectedQuery.date).toLocaleString()}</span>
                      <span>•</span>
                      <span>{selectedQuery.llmCount} LLMs ranked</span>
                      {selectedQuery.bestLLM && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                            Best: {selectedQuery.bestLLM}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={onQueryDeselect}
                    variant="outline"
                    className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Close
                  </Button>
                </div>
              </div>

              {/* Filter and Sort Controls */}
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#1e293b] rounded-lg border border-gray-200 dark:border-gray-700/50">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <select
                    value={filterModel}
                    onChange={(e) => setFilterModel(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Models</option>
                    {filterModelOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="highToLow">High to Low (Rank 1→5)</option>
                    <option value="lowToHigh">Low to High (Rank 5→1)</option>
                  </select>
                </div>
              </div>

              {/* Human vs original rankings (history): preferred column keeps saved order; original sorted by score */}
              {waitingForHistoryFetch ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600 dark:text-gray-300">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                  <p className="text-sm font-medium">Loading rankings…</p>
                </div>
              ) : historyFetchFailed ? (
                <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/25">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-800 dark:text-red-200">{rankingError}</p>
                </div>
              ) : showDualPanels ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <section className="space-y-3 min-w-0">
                    <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 border-b border-indigo-200 dark:border-indigo-800 pb-2">
                      Your preferred order
                    </h3>
                    <div className="space-y-4">{renderHistoryCardList(preferredDisplay)}</div>
                  </section>
                  <section className="space-y-3 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2">
                      Original ranking (preview score)
                    </h3>
                    <div className="space-y-4">{renderHistoryCardList(originalDisplay)}</div>
                  </section>
                </div>
              ) : (
                <div className="space-y-4">{renderHistoryCardList(preferredDisplay)}</div>
              )}
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="space-y-3">
                <SearchBar 
                  value={query} 
                  onChange={setQuery} 
                  onSubmit={handleQuerySubmit}
                  isLoading={isProcessing}
                />
                
                {/* Query Status Indicator */}
                {querySubmitted && (
                  <div
                    className={cn(
                      "flex flex-col gap-2 p-3 rounded-lg transition-all duration-300 animate-in fade-in slide-in-from-top-2",
                      submitError && !isProcessing
                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                        : isProcessing
                          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                          : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {submitError && !isProcessing ? (
                        <>
                          <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                          <p className="text-sm font-medium text-red-700 dark:text-red-300">{submitError}</p>
                        </>
                      ) : isProcessing ? (
                        <>
                          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Fetching model responses...
                          </p>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">
                            Query processed successfully!
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Mobile / narrow: same ranked cards as right panel */}
                {!selectedQuery && activeRankQuery && (
                  <div className="lg:hidden space-y-4">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                        Query
                      </p>
                      <p className="rankings-panel-excerpt text-gray-900 dark:text-gray-100">{activeRankQuery}</p>
                    </div>
                    {rankingScoreSource === "placeholder" && rankingSnapshot?.query === activeRankQuery &&
                      Array.isArray(rankingSnapshot.results) &&
                      rankingSnapshot.results.length > 0 && (
                      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                        Scores are <strong>placeholders</strong> (sidebar order): the Python ranker on port 5056 did not respond. Run{" "}
                        <code className="text-[10px]">python rank_transformers_service.py</code> and restart the Node server if needed.
                      </p>
                    )}
                    {rankingLoading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-600 dark:text-gray-300">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <p className="text-sm font-medium">Calling selected models…</p>
                      </div>
                    ) : rankingError ? (
                      <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/25">
                        <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                        <p className="text-sm text-red-800 dark:text-red-200">{rankingError}</p>
                      </div>
                    ) : rankingSnapshot?.query === activeRankQuery &&
                      Array.isArray(rankingSnapshot.results) &&
                      rankingSnapshot.results.length > 0 ? (
                      rankingHasUserRankPreference &&
                      Array.isArray(rankingOriginalResults) &&
                      rankingOriginalResults.length > 0 ? (
                        <div className="space-y-8">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                              Original ranking (preview score)
                            </p>
                            <RankedResultsBlock
                              results={rankingOriginalResults}
                              batchId={undefined}
                              query={
                                rankingSnapshot?.query === activeRankQuery
                                  ? rankingSnapshot.query
                                  : activeRankQuery
                              }
                            />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">
                              Your preferred order
                            </p>
                            <RankedResultsBlock
                              results={rankingSnapshot.results}
                              batchId={
                                rankingSnapshot?.query === activeRankQuery
                                  ? rankingBatchId
                                  : undefined
                              }
                              query={
                                rankingSnapshot?.query === activeRankQuery
                                  ? rankingSnapshot.query
                                  : activeRankQuery
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <RankedResultsBlock
                          results={rankingSnapshot.results}
                          batchId={
                            rankingSnapshot?.query === activeRankQuery
                              ? rankingBatchId
                              : undefined
                          }
                          query={
                            rankingSnapshot?.query === activeRankQuery
                              ? rankingSnapshot.query
                              : activeRankQuery
                          }
                        />
                      )
                    ) : null}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    onClick={handleTrain}
                    disabled={!trainingReady || trainLoading}
                    title={
                      trainingReady
                        ? "Score with CrossEncoder and blend with system rankings"
                        : "Load an accepted CSV/XLSX or paste first"
                    }
                    className="button-icon-text bg-black dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {trainLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Settings className="w-4 h-4" />
                    )}
                    {trainLoading ? "Training…" : "Train"}
                  </Button>
                  <Button
                    onClick={handleResults}
                    variant="secondary"
                    disabled={!trainingResult?.rows?.length}
                    title={
                      trainingResult?.rows?.length
                        ? "View rankings, charts, and downloads"
                        : "Train the dataset first"
                    }
                    className="button-icon-text bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 text-white disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Results
                  </Button>
                </div>
                {trainError && (
                  <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{trainError}</span>
                  </div>
                )}
              </div>

              {/* Upload Box */}
              <UploadBox onTrainingDataChange={handleTrainingDataChange} />
            </>
          )}
        </div>
      </div>

      <TrainingResultsModal
        open={resultsModalOpen}
        result={trainingResult}
        onClose={() => setResultsModalOpen(false)}
      />
    </div>
  )
}

export default MainContent
