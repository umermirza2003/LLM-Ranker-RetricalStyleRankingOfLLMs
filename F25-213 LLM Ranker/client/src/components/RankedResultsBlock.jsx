import { useEffect, useMemo, useState } from "react"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { getApiBaseUrl } from "@/lib/apiBase"
import { stripQueryAnswerBoilerplate } from "@/utils/stripQueryAnswerBoilerplate"
import { Button } from "./ui/button"
import ResponseExpandModal from "./ResponseExpandModal"

/** Visible snippet only — keeps ranking cards short vs the query strip above. */
const PREVIEW_MAX_WORDS = 5

/** @param {string} raw */
function normalizeResponse(raw) {
  return typeof raw === "string" ? raw.replace(/\r\n/g, "\n") : String(raw ?? "")
}

/** First words only + ellipsis (full answer stays behind “View full response”). */
function responsePreviewWords(normalized) {
  const flat = String(normalized ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (!flat) return "—"
  const words = flat.split(" ").filter(Boolean)
  if (words.length === 0) return "—"
  if (words.length <= PREVIEW_MAX_WORDS) return words.join(" ")
  return `${words.slice(0, PREVIEW_MAX_WORDS).join(" ")}…`
}

/** @param {string} normalized */
function responseIsExpandable(normalized) {
  const flat = String(normalized ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (!flat) return false
  const words = flat.split(" ").filter(Boolean)
  return words.length > PREVIEW_MAX_WORDS || String(normalized ?? "").includes("\n")
}

/** @typedef {{ dragId: string, llm: string, response: string, score?: number|null }} RowWithDrag */

function fingerprint(order) {
  return order.map((r) => r.llm).join("\0")
}

function SortableRankCard({
  row,
  rank,
  isTop,
  isBottom,
  topScore,
  bottomScore,
  resultsLength,
  onOpenPreview,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.dragId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const scoreNum =
    typeof row.score === "number" ? row.score : Number(row.score)
  const full = stripQueryAnswerBoilerplate(normalizeResponse(row.response))
  const preview = responsePreviewWords(full)
  const expandable = responseIsExpandable(full)
  const hasBody = Boolean(full.trim())

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border p-4 shadow-sm transition-shadow sm:p-5",
        isDragging && "relative z-[1] ring-2 ring-indigo-400/80",
        isTop &&
          "border-amber-400/80 bg-amber-50/90 ring-2 ring-amber-300/70 dark:bg-amber-950/35 dark:border-amber-500/60 dark:ring-amber-500/40",
        isBottom &&
          !isTop &&
          "border-slate-300/80 bg-slate-50/80 dark:bg-slate-900/60 dark:border-slate-600/70 opacity-95",
        !isTop &&
          !isBottom &&
          "border-gray-200 bg-white dark:bg-[#1e293b] dark:border-gray-700/50",
      )}
    >
      <div className="flex gap-3">
        <button
          type="button"
          className={cn(
            "mt-1 shrink-0 cursor-grab touch-none rounded-md p-1 text-gray-400 outline-none hover:bg-black/[0.06] hover:text-gray-600 active:cursor-grabbing dark:hover:bg-white/10 dark:hover:text-gray-300",
            "focus-visible:ring-2 focus-visible:ring-indigo-500/70",
          )}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder ranking"
        >
          <GripVertical className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                  isTop ?
                    "bg-amber-500 text-white dark:bg-amber-600"
                  : isBottom ?
                    "bg-slate-400 text-white dark:bg-slate-600"
                  : "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100",
                )}
              >
                {rank}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">
                  {row.llm}
                </h3>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                  Preview score:{" "}
                  <span className="font-mono font-medium tabular-nums">
                    {!Number.isFinite(scoreNum) ?
                      "—"
                    : scoreNum >= topScore && resultsLength > 1 ?
                      `${scoreNum.toFixed(4)} (highest)`
                    : scoreNum <= bottomScore && resultsLength > 1 ?
                      `${scoreNum.toFixed(4)} (lowest)`
                    : scoreNum.toFixed(4)}
                  </span>
                </p>
              </div>
            </div>
            {isTop && (
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Rank #1
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={!hasBody}
            onClick={() => onOpenPreview({ llm: row.llm, normalized: full })}
            className={cn(
              "group flex w-full items-start gap-3 rounded-lg text-left text-sm outline-none transition-colors",
              "text-gray-800 dark:text-gray-200",
              hasBody &&
                "-mx-2 px-2 py-1.5 hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:hover:bg-white/[0.06]",
              !hasBody && "cursor-default opacity-60",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-gray-800 dark:text-gray-200 line-clamp-2">
                {preview}
              </p>
              {hasBody && expandable ?
                <span className="mt-1 block text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  View full response
                </span>
              : null}
            </div>
            <span
              className={cn(
                "mt-0.5 shrink-0 rounded-md p-1.5 transition-colors",
                hasBody &&
                  "text-gray-400 group-hover:bg-indigo-500/15 group-hover:text-indigo-600 dark:group-hover:text-indigo-400",
              )}
              aria-hidden
            >
              <ExternalLink className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </article>
  )
}

/**
 * Displays ranked model replies; optional drag reorder + persist when `batchId` is set.
 * @param {{ llm: string, response: string, score?: number|null }[]} results
 */
function RankedResultsBlock({ results, className, batchId, query }) {
  const [modal, setModal] = useState(null)
  /** @type {[RowWithDrag[], function]} */
  const [rows, setRows] = useState([])
  const [baselineFp, setBaselineFp] = useState("")
  const [saveState, setSaveState] = useState(null)

  const resultsJson = JSON.stringify(results ?? [])
  const dragEnabled = Boolean(batchId) && typeof query === "string" && query.trim() && rows.length > 1

  useEffect(() => {
    const canonical = Array.isArray(results) ? [...results] : []
    /** @type {RowWithDrag[]} */
    const next = canonical.map((r) => ({
      dragId:
        typeof crypto !== "undefined" && crypto.randomUUID ?
          crypto.randomUUID()
        : `d-${batchId}-${r.llm}-${Math.random().toFixed(8)}`,
      llm: r.llm,
      response:
        typeof r.response === "string" ? r.response : String(r.response ?? ""),
      score: r.score,
    }))
    setRows(next)
    setBaselineFp(fingerprint(next))
    setSaveState(null)
  }, [batchId, resultsJson])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const topScore = Number(rows[0]?.score)
  const bottomScore = Number(rows[rows.length - 1]?.score)

  const currentFp = useMemo(() => fingerprint(rows), [rows])

  const dirty =
    dragEnabled &&
    baselineFp !== currentFp &&
    rows.length === (Array.isArray(results) ? results.length : 0)

  /** @param {{ llm: string, normalized: string }} p */
  const openPreview = (p) => {
    const norm = normalizeResponse(p.normalized)
    if (!norm.trim()) return
    setModal({ llm: p.llm, responseText: norm })
  }

  const handleDragEnd = (event) => {
    if (!dragEnabled) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.dragId === active.id)
      const newIndex = prev.findIndex((r) => r.dragId === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const handleSavePreference = async () => {
    if (!batchId || !query?.trim() || !dirty) return
    setSaveState("saving")
    try {
      const res = await fetch(`${getApiBaseUrl()}/custom-ranking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          query: query.trim(),
          orderedLlms: rows.map((r) => r.llm),
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || `Save failed (${res.status})`)
      }
      setBaselineFp(currentFp)
      setSaveState("ok")
      setTimeout(() => setSaveState((s) => (s === "ok" ? null : s)), 2500)
    } catch (e) {
      setSaveState(`err:${e?.message || "Failed"}`)
    }
  }

  if (!Array.isArray(results) || results.length === 0) return null

  return (
    <div className={cn("space-y-4", className)}>
      <ResponseExpandModal
        open={Boolean(modal)}
        modelName={modal?.llm}
        responseText={modal?.responseText}
        onClose={() => setModal(null)}
      />

      {dragEnabled ?
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rows.map((r) => r.dragId)}
            strategy={verticalListSortingStrategy}
          >
            {rows.map((row, idx) => {
              const rank = idx + 1
              const isTop = idx === 0
              const isBottom = idx === rows.length - 1
              return (
                <SortableRankCard
                  key={row.dragId}
                  row={row}
                  rank={rank}
                  isTop={isTop}
                  isBottom={isBottom}
                  topScore={topScore}
                  bottomScore={bottomScore}
                  resultsLength={rows.length}
                  onOpenPreview={openPreview}
                />
              )
            })}
          </SortableContext>
        </DndContext>
      : rows.map((row, idx) => {
          const rank = idx + 1
          const isTop = idx === 0
          const isBottom = idx === rows.length - 1
          const scoreNum =
            typeof row.score === "number" ? row.score : Number(row.score)
          const full = stripQueryAnswerBoilerplate(normalizeResponse(row.response))
          const preview = responsePreviewWords(full)
          const expandable = responseIsExpandable(full)
          const hasBody = Boolean(full.trim())
          return (
            <article
              key={
                `${row.llm}-${rank}-${batchId ?? "na"}-${idx}`
              }
              className={cn(
                "rounded-xl border p-4 shadow-sm transition-shadow sm:p-5",
                isTop &&
                  "border-amber-400/80 bg-amber-50/90 ring-2 ring-amber-300/70 dark:bg-amber-950/35 dark:border-amber-500/60 dark:ring-amber-500/40",
                isBottom &&
                  !isTop &&
                  "border-slate-300/80 bg-slate-50/80 dark:bg-slate-900/60 dark:border-slate-600/70 opacity-95",
                !isTop &&
                  !isBottom &&
                  "border-gray-200 bg-white dark:bg-[#1e293b] dark:border-gray-700/50",
              )}
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                      isTop ?
                        "bg-amber-500 text-white dark:bg-amber-600"
                      : isBottom ?
                        "bg-slate-400 text-white dark:bg-slate-600"
                      : "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100",
                    )}
                  >
                    {rank}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">
                      {row.llm}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                      Preview score:{" "}
                      <span className="font-mono font-medium tabular-nums">
                        {!Number.isFinite(scoreNum) ?
                          "—"
                        : scoreNum >= topScore && rows.length > 1 ?
                          `${scoreNum.toFixed(4)} (highest)`
                        : scoreNum <= bottomScore && rows.length > 1 ?
                          `${scoreNum.toFixed(4)} (lowest)`
                        : scoreNum.toFixed(4)}
                      </span>
                    </p>
                  </div>
                </div>
                {isTop && (
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    Rank #1
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={!hasBody}
                onClick={() => openPreview({ llm: row.llm, normalized: full })}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-lg text-left text-sm outline-none transition-colors",
                  "text-gray-800 dark:text-gray-200",
                  hasBody &&
                    "-mx-2 px-2 py-1.5 hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:hover:bg-white/[0.06]",
                  !hasBody && "cursor-default opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-gray-800 dark:text-gray-200 line-clamp-2">{preview}</p>
                  {hasBody && expandable ?
                    <span className="mt-1 block text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      View full response
                    </span>
                  : null}
                </div>
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-md p-1.5 transition-colors",
                    hasBody &&
                      "text-gray-400 group-hover:bg-indigo-500/15 group-hover:text-indigo-600 dark:group-hover:text-indigo-400",
                  )}
                  aria-hidden
                >
                  <ExternalLink className="h-4 w-4" />
                </span>
              </button>
            </article>
          )
        })
      }

      {batchId && dragEnabled && dirty ?
        <div
          className={cn(
            "sticky bottom-1 z-10 flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/95 p-3 shadow-md dark:border-indigo-800 dark:bg-indigo-950/90",
          )}
        >
          <p className="text-xs text-indigo-900 dark:text-indigo-100">
            Drag models to set your preferred order, then confirm to save this ranking for this
            query.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={handleSavePreference} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Saving…" : "Okay"}
            </Button>
            {saveState === "ok" ?
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Saved.</span>
            : saveState?.startsWith("err:") ?
              <span className="text-xs text-red-700 dark:text-red-400">{saveState.slice(4)}</span>
            : null}
          </div>
        </div>
      : null}

      {!batchId && rows.length > 1 ?
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
          Ranking order can&apos;t be saved until this run has a stored batch id (submit a fresh query
          from the home ranker flow).
        </p>
      : null}
    </div>
  )
}

export default RankedResultsBlock
