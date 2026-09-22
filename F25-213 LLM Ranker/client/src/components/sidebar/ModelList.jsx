import { useState, useEffect, useRef } from "react"
import { Search, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getApiBaseUrl } from "@/lib/apiBase"

function canUseModel(row) {
  return Boolean(row?.configured && row?.hasApiKey)
}

/** Matches server PUBLIC_PANEL_LABELS — used only if API omits `name`. */
const FALLBACK_PANEL_LABELS = [
  "Gemini",
  "Chat GPT",
  "Copilot",
  "Claude",
  "Perplexity",
  "Z AI",
  "MGX",
  "DeepSeek",
  "Toolsaday",
  "Grok",
  "Meta",
  "Pi AI",
  "Sciweave",
  "Resea",
  "Deft GPT",
  "Deep AI",
  "Character AI",
  "KoalaChat",
  "FastBots",
  "ChatBot App",
  "Julius",
  "Gemma",
  "Mistral",
  "ChatGLM",
  "Qwen AI",
  "Replika AI",
  "Tulu Allen AI",
  "Noor AI",
  "Poe",
  "Llama",
]

function resolvePanelLabel(panelSlot, apiName) {
  const trimmed = apiName == null ? "" : String(apiName).trim()
  if (trimmed.length > 0) return trimmed
  const i = Number(panelSlot) - 1
  if (Number.isFinite(i) && i >= 0 && i < FALLBACK_PANEL_LABELS.length) return FALLBACK_PANEL_LABELS[i]
  return panelSlot != null && `${panelSlot}`.trim() !== "" ? `Slot ${panelSlot}` : ""
}

/** Keeps wired flags from `/providers` while always filling all 30 display names from FALLBACK_PANEL_LABELS. */
function mergeCatalogRows(rows) {
  const bySlot = new Map((Array.isArray(rows) ? rows : []).map((r) => [r.slot, r]))
  return FALLBACK_PANEL_LABELS.map((__, idx) => {
    const slot = idx + 1
    const p = bySlot.get(slot)
    const configured = typeof p?.configured === "boolean" ? p.configured : false
    const hasApiKey = Boolean(p?.hasApiKey)
    const name = resolvePanelLabel(slot, p?.name)
    return {
      id: slot,
      name,
      configured,
      hasApiKey,
    }
  }).sort(byAvailabilityThenSlot)
}

/** Wired / clickable models first, then placeholders; tie-break by panel slot order. */
function byAvailabilityThenSlot(a, b) {
  const ar = canUseModel(a) ? 0 : 1
  const br = canUseModel(b) ? 0 : 1
  if (ar !== br) return ar - br
  return Number(a.id) - Number(b.id)
}

function ModelGridTile({
  model,
  catalogLoading,
  hasRows,
  isSelected,
  onToggle,
}) {
  const selectable = canUseModel(model)
  const title =
    !model.configured
      ? "Add API URL for this slot in server/.env"
      : selectable
        ? undefined
        : "Add API key for this slot in server/.env"

  return (
    <button
      type="button"
      onClick={() => onToggle(model)}
      disabled={catalogLoading || !hasRows}
      aria-disabled={!selectable}
      title={title}
      className={cn(
        "relative px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 text-left border min-h-[2.5rem] flex items-center",
        !selectable &&
          "opacity-55 saturate-[0.85] cursor-not-allowed border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/65 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/65 shadow-none",
        selectable &&
          (isSelected
            ? "bg-indigo-600 dark:bg-indigo-700 text-white shadow-md border-transparent"
            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 border-transparent")
      )}
    >
      <div className="flex items-center justify-between gap-2 w-full min-w-0">
        <span className={cn("truncate", !selectable && "italic")}>{model.name}</span>
        {isSelected && selectable && (
          <Check className="w-3.5 h-3.5 ml-1.5 flex-shrink-0 opacity-95" />
        )}
      </div>
    </button>
  )
}

const ModelList = ({ selectedModels, setSelectedModels }) => {
  const [searchQuery, setSearchQuery] = useState("")
  /** Start expanded so all slots (e.g. 30) are visible inside the scroll area. */
  const [isExpanded, setIsExpanded] = useState(true)
  const [aiModels, setAiModels] = useState(null)
  const [catalogError, setCatalogError] = useState(null)
  const [selectFeedback, setSelectFeedback] = useState(null)
  const selectFeedbackTimer = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      setCatalogError(null)
      try {
        const res = await fetch(`${getApiBaseUrl()}/providers`, { method: "GET" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || `Could not load models (${res.status})`)
        }
        const rows = Array.isArray(data.providers) ? data.providers : []
        if (!cancelled) setAiModels(mergeCatalogRows(rows))
      } catch (e) {
        console.warn("[ModelList]", e.message)
        if (!cancelled) {
          setCatalogError(e.message || "Failed to load configured models.")
          setAiModels(mergeCatalogRows([]))
        }
      }
    }

    loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!Array.isArray(aiModels)) return
    setSelectedModels((prev) => {
      const eligible = aiModels.filter((m) => canUseModel(m)).map((m) => m.id)
      const eligibleSet = new Set(eligible)
      return prev.filter((id) => eligibleSet.has(id))
    })
  }, [aiModels, setSelectedModels])

  const showBlockedFeedback = (msg) => {
    setSelectFeedback(msg)
    clearTimeout(selectFeedbackTimer.current)
    selectFeedbackTimer.current = setTimeout(() => setSelectFeedback(null), 4000)
  }

  useEffect(() => {
    return () => clearTimeout(selectFeedbackTimer.current)
  }, [])

  const toggleModel = (model) => {
    if (!model?.configured) {
      showBlockedFeedback(
        "Finish setup — add API URL (and NAME) for this slot in server/.env, then restart the server."
      )
      return
    }
    if (!model?.hasApiKey) {
      showBlockedFeedback(
        "No API key — add the key for this slot in server/.env, then restart the server."
      )
      return
    }
    const modelId = model.id
    setSelectedModels((prev) => {
      const updated = prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
      return updated
    })
  }

  const resolvedModels = Array.isArray(aiModels) ? aiModels : []

  // Filter models based on search; keep available rows on top within the filtered set.
  const filteredModels = resolvedModels
    .filter((model) => model.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(byAvailabilityThenSlot)

  const selectedEntries = resolvedModels
    .filter((model) => selectedModels.includes(model.id))
    .sort(byAvailabilityThenSlot)

  const selectableInFilter = filteredModels.filter((m) => canUseModel(m))

  // Show first 6 models when collapsed, all when expanded
  const displayedModels = isExpanded ? filteredModels : filteredModels.slice(0, 6)

  const allSelectableInFilterChosen =
    selectableInFilter.length > 0 &&
    selectableInFilter.every((model) => selectedModels.includes(model.id))

  const availDisplayed = displayedModels.filter((m) => canUseModel(m))
  const otherDisplayed = displayedModels.filter((m) => !canUseModel(m))

  const toggleSelectAll = () => {
    const selectableIds = selectableInFilter.map((m) => m.id)
    if (selectableIds.length === 0) return

    if (allSelectableInFilterChosen) {
      setSelectedModels((prev) => {
        const idSet = new Set(selectableIds)
        return prev.filter((id) => !idSet.has(id))
      })
    } else {
      setSelectedModels((prev) => [...new Set([...prev, ...selectableIds])])
    }
  }

  const catalogLoading = aiModels === null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title text-sm tracking-tight">
          Select AI Models
        </h2>
        {selectedModels.length > 0 && (
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-full">
            {selectedModels.length} selected
          </span>
        )}
      </div>

      {/* Select All Checkbox */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="checkbox"
          id="select-all"
          checked={allSelectableInFilterChosen}
          onChange={toggleSelectAll}
          disabled={catalogLoading || selectableInFilter.length === 0}
          className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
        />
        <label
          htmlFor="select-all"
          className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
        >
          Select All
        </label>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={catalogLoading || resolvedModels.length === 0}
          className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
        />
      </div>

      {catalogLoading && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Loading models…</p>
      )}

      {!catalogLoading && catalogError && (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">{catalogError}</p>
      )}

      {!catalogLoading && resolvedModels.length === 0 && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Could not load the model catalogue. Restart the API and check GET /providers.
        </p>
      )}

      {selectFeedback && (
        <p className="mb-3 text-xs font-medium text-amber-600 dark:text-amber-400" role="status">
          {selectFeedback}
        </p>
      )}

      {/* Selected Models Chips */}
      {selectedEntries.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selectedEntries.map((model) => (
            <button
              key={model.id}
              onClick={() => toggleModel(model)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
            >
              {model.name}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Models Grid — available/run models first */}
      <div className="grid grid-cols-2 gap-2 max-h-[min(55vh,480px)] overflow-y-auto pr-1">
        {availDisplayed.length > 0 && otherDisplayed.length > 0 ? (
          <p className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Available
          </p>
        ) : null}
        {availDisplayed.map((model) => (
          <ModelGridTile
            key={model.id}
            model={model}
            catalogLoading={catalogLoading}
            hasRows={resolvedModels.length > 0}
            isSelected={selectedModels.includes(model.id)}
            onToggle={toggleModel}
          />
        ))}
        {otherDisplayed.length > 0 ? (
          <>
            {availDisplayed.length > 0 ? (
              <p className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-600">
                Coming soon · not selectable
              </p>
            ) : null}
            {otherDisplayed.map((model) => (
              <ModelGridTile
                key={model.id}
                model={model}
                catalogLoading={catalogLoading}
                hasRows={resolvedModels.length > 0}
                isSelected={selectedModels.includes(model.id)}
                onToggle={toggleModel}
              />
            ))}
          </>
        ) : null}
      </div>

      {/* Show More/Less Button */}
      {filteredModels.length > 6 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 w-full text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
        >
          {isExpanded ? "Show Less" : `Show All (${filteredModels.length - 6} more)`}
        </button>
      )}
    </div>
  )
}

export default ModelList

