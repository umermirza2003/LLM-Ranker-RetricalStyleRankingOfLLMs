import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, Download, BarChart3, Camera, Loader2 } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import {
  downloadTrainingCsv,
  downloadTrainingXlsx,
} from "@/utils/trainingResultsExport"
import { downloadTrainingChartsZip } from "@/utils/trainingChartsExport"

const LINE_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#3b82f6",
  "#84cc16",
  "#f97316",
  "#8b5cf6",
  "#10b981",
  "#64748b",
  "#d946ef",
  "#0ea5e9",
  "#f43f5e",
]

function perQueryBarData(pq) {
  const list = Array.isArray(pq?.rows) ? [...pq.rows] : []
  list.sort((a, b) => (b.aggregatedScore ?? 0) - (a.aggregatedScore ?? 0))
  return list.map((r) => ({
    name: String(r.llm).length > 28 ? `${String(r.llm).slice(0, 26)}…` : String(r.llm),
    fullName: r.llm,
    aggregated: Number(r.aggregatedScore ?? 0),
    ceNorm: Number(r.crossEncoderNorm ?? 0),
    hasSystem: r.usesSystemStats,
  }))
}

function TrainingResultsModal({ open, result, onClose }) {
  const chartsRootRef = useRef(null)
  const [chartsBusy, setChartsBusy] = useState(false)
  const [chartsMsg, setChartsMsg] = useState(null)
  const [lineChartTopN, setLineChartTopN] = useState(18)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setChartsBusy(false)
      setChartsMsg(null)
    }
  }, [open])

  useEffect(() => {
    if (!result) return
    const m = Array.isArray(result.llmLineMeta) ? result.llmLineMeta.length : 0
    if (m > 0) {
      setLineChartTopN(Math.min(18, m))
    }
  }, [result])

  if (!open || !result) return null

  const handleDownloadAllCharts = async () => {
    setChartsMsg(null)
    setChartsBusy(true)
    try {
      const r = await downloadTrainingChartsZip(chartsRootRef.current)
      if (!r.ok) setChartsMsg(r.error || "Could not export charts.")
    } finally {
      setChartsBusy(false)
    }
  }

  const isMulti = result.multiQuery === true
  const rows = Array.isArray(result.rows) ? result.rows : []
  const perQuery = Array.isArray(result.perQuery) ? result.perQuery : []
  const lineData = Array.isArray(result.queryLineData) ? result.queryLineData : []
  const lineMeta = Array.isArray(result.llmLineMeta) ? result.llmLineMeta : []
  const lineChartCount = Math.min(lineChartTopN, lineMeta.length) || 0
  const visibleLineMeta =
    lineChartCount > 0 ? lineMeta.slice(0, lineChartCount) : []
  const rowCountForStats =
    isMulti && result.systemStatsDetail?.totalRowsGraded != null
      ? result.systemStatsDetail.totalRowsGraded
      : rows.length

  /** Best LLMs at top of chart */
  const chartData = [...rows]
    .sort((a, b) => (b.aggregatedScore ?? 0) - (a.aggregatedScore ?? 0))
    .map((r) => ({
      name:
        String(r.llm).length > 28 ? `${String(r.llm).slice(0, 26)}…` : String(r.llm),
      fullName: r.llm,
      aggregated: Number(r.aggregatedScore ?? 0),
      ceNorm: Number(r.crossEncoderNorm ?? 0),
      hasSystem: r.usesSystemStats,
    }))

  const chartHeight = Math.min(960, Math.max(280, chartData.length * 32))
  const lineChartHeight = Math.min(
    560,
    Math.max(300, lineData.length * 36 + Math.min(visibleLineMeta.length, 24) * 10 + 120),
  )
  const perQueryList = isMulti && perQuery.length > 0 ? perQuery : []

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px] dark:bg-black/65"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-results-title"
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950 dark:ring-1 dark:ring-slate-700/80"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <h2
              id="training-results-title"
              className="truncate text-lg font-semibold text-gray-900 dark:text-gray-50"
            >
              Training results
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 dark:border-slate-600 dark:text-gray-200"
              onClick={() => downloadTrainingCsv(result)}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 dark:border-slate-600 dark:text-gray-200"
              onClick={() => downloadTrainingXlsx(result)}
            >
              <Download className="h-4 w-4" />
              XLSX
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 dark:border-slate-600 dark:text-gray-200"
              disabled={chartsBusy}
              title="PNG screenshots of each chart in one ZIP file"
              onClick={handleDownloadAllCharts}
            >
              {chartsBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Charts (ZIP)
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        {chartsMsg ? (
          <p
            className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
            role="status"
          >
            {chartsMsg}
          </p>
        ) : null}

        <div ref={chartsRootRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
            <p className="font-medium text-gray-800 dark:text-gray-100">
              {isMulti ? "Run summary" : "Query"}
            </p>
            <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {result.query}
            </p>
            {isMulti && result.queryCount != null ? (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {result.queryCount} quer{result.queryCount === 1 ? "y" : "ies"} trained (all sheets and
                all Query blocks in the file).
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
              <span>
                Blend (CrossEncoder weight):{" "}
                <strong className="text-gray-800 dark:text-gray-200">
                  {typeof result.blendWeight === "number" ? result.blendWeight.toFixed(2) : "—"}
                </strong>
              </span>
              {result.crossEncoderMode === "fallback" ? (
                <span className="text-amber-800 dark:text-amber-200 font-medium">
                  CrossEncoder offline — scores use row-order placeholders until{" "}
                  <code className="text-[10px]">ranking_service.py</code> is running.
                </span>
              ) : (
                <span className="text-gray-600 dark:text-gray-400">CrossEncoder scores applied.</span>
              )}
              {result.systemStatsAvailable ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Blended with SQLite model statistics where names matched.
                </span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">
                  No system blend for this run (see details below).
                </span>
              )}
            </div>
            {result.systemStatsDetail ? (
              <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-0.5 list-disc pl-4">
                <li>
                  History batches in DB:{" "}
                  <strong className="text-gray-800 dark:text-gray-200">
                    {result.systemStatsDetail.dbBatchCount ?? 0}
                  </strong>
                  {" · "}
                  Models with scores:{" "}
                  <strong className="text-gray-800 dark:text-gray-200">
                    {result.systemStatsDetail.modelsWithScore ?? 0}
                  </strong>
                </li>
                <li>
                  Upload rows that matched an app model:{" "}
                  <strong className="text-gray-800 dark:text-gray-200">
                    {result.systemStatsDetail.uploadRowsMatchedSystem ?? 0}
                  </strong>
                  {" / "}
                  {rowCountForStats}
                </li>
              </ul>
            ) : null}
            {result.systemStatsHint ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                {result.systemStatsHint}
              </p>
            ) : null}
            {result.crossEncoderWarning && result.crossEncoderMode === "fallback" ? (
              <p className="mt-2 text-xs text-amber-900/90 dark:text-amber-100/90">{result.crossEncoderWarning}</p>
            ) : null}
          </div>

          {isMulti && lineData.length > 0 && lineMeta.length > 0 ? (
            <section className="mb-6">
              <div
                data-training-chart-capture="line-across-queries"
                className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Aggregated score across queries (top LLMs)
                </h3>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    One point per query × sheet block; each line is an LLM (mean-ranked globally).
                    Showing top{" "}
                    <strong className="text-gray-800 dark:text-gray-200">{lineChartCount}</strong> of{" "}
                    <strong className="text-gray-800 dark:text-gray-200">{lineMeta.length}</strong>.
                  </p>
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <span className="whitespace-nowrap">Show top</span>
                    <Input
                      type="number"
                      min={1}
                      max={lineMeta.length}
                      inputMode="numeric"
                      className="h-8 w-[4.5rem] dark:border-slate-600"
                      value={lineChartTopN}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        if (!Number.isFinite(v)) return
                        setLineChartTopN(Math.min(Math.max(1, v), lineMeta.length))
                      }}
                    />
                    <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      (1–{lineMeta.length})
                    </span>
                  </label>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/40">
                <ResponsiveContainer width="100%" height={lineChartHeight}>
                  <LineChart
                    data={lineData}
                    margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-700" />
                    <XAxis
                      dataKey="queryLabel"
                      tick={{ fontSize: 9 }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={Math.min(160, 56 + lineData.length * 10)}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 11 }}
                      width={36}
                    />
                    <Tooltip
                      formatter={(value) =>
                        typeof value === "number" && Number.isFinite(value)
                          ? value.toFixed(4)
                          : "—"
                      }
                      labelFormatter={(_, p) => p?.[0]?.payload?.fullQuery ?? ""}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                        maxWidth: 320,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    {visibleLineMeta.map((m, i) => (
                      <Line
                        key={m.key}
                        type="monotone"
                        dataKey={m.key}
                        name={m.llm}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mb-6">
            <div
              data-training-chart-capture="mean-llm-performance"
              className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                {isMulti
                  ? "Mean performance by LLM (across all queries)"
                  : "Performance by LLM (aggregated score)"}
              </h3>
              <div className="rounded-xl border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/40">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-700" />
                  <XAxis
                    type="number"
                    domain={[0, 1]}
                    tick={{ fontSize: 11 }}
                    className="text-gray-600"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={132}
                    tick={{ fontSize: 10 }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      typeof value === "number" ? value.toFixed(4) : value,
                      name === "aggregated" ? "Aggregated" : name,
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullName ?? ""
                    }
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar
                    dataKey="aggregated"
                    name="Aggregated"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar dataKey="ceNorm" name="CE norm" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </section>

          {perQueryList.length > 0 ? (
            <section className="mb-8">
              <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                Per-query rankings (every sheet × query block)
              </h3>
              <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
                Same dual-bar layout as a single train run: aggregated blend vs CrossEncoder norm (per
                query).
              </p>
              <div className="grid gap-6 lg:grid-cols-2">
                {perQueryList.map((pq, idx) => {
                  const pqChart = perQueryBarData(pq)
                  const bh = Math.min(720, Math.max(220, pqChart.length * 30))
                  const sheetPart = pq.sheetName ? `${pq.sheetName} · ` : ""
                  const title = `${sheetPart}${pq.query || `Query ${idx + 1}`}`
                  return (
                    <div
                      key={`pq-${idx}-${pq.sheetName}-${pq.runIndex}`}
                      data-training-chart-capture={`per-query-${String(idx + 1).padStart(3, "0")}`}
                      className="rounded-xl border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/40"
                    >
                      <h4
                        className="mb-2 px-1 text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug"
                        title={title}
                      >
                        {pq.sheetName ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px] block mb-0.5">
                            {pq.sheetName}
                          </span>
                        ) : null}
                        <span className="line-clamp-3">
                          {pq.query && pq.query.length > 180
                            ? `${pq.query.slice(0, 178)}…`
                            : pq.query || "—"}
                        </span>
                      </h4>
                      <ResponsiveContainer width="100%" height={bh}>
                        <BarChart
                          data={pqChart}
                          layout="vertical"
                          margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-gray-200 dark:stroke-slate-700"
                          />
                          <XAxis
                            type="number"
                            domain={[0, 1]}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={120}
                            tick={{ fontSize: 9 }}
                            interval={0}
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              typeof value === "number" ? value.toFixed(4) : value,
                              name === "aggregated" ? "Aggregated" : name,
                            ]}
                            labelFormatter={(_, payload) =>
                              payload?.[0]?.payload?.fullName ?? ""
                            }
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid #e5e7eb",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar
                            dataKey="aggregated"
                            name="Aggregated"
                            fill="#6366f1"
                            radius={[0, 4, 4, 0]}
                          />
                          <Bar
                            dataKey="ceNorm"
                            name="CE norm"
                            fill="#94a3b8"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              {isMulti ? "Summary table (mean across queries)" : "Rankings table"}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
              <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
                <thead className="bg-gray-100 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Rank</th>
                    <th className="px-3 py-2 font-semibold">LLM</th>
                    {isMulti ? (
                      <th className="px-3 py-2 font-semibold" title="How many queries this LLM was graded on">
                        Queries
                      </th>
                    ) : null}
                    <th className="px-3 py-2 font-semibold">Aggregated</th>
                    <th className="px-3 py-2 font-semibold">
                      {isMulti ? "CE norm (mean)" : "CE score"}
                    </th>
                    <th className="px-3 py-2 font-semibold">App stats</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.rank}-${r.llm}`}
                      className="border-t border-gray-100 dark:border-slate-800"
                    >
                      <td className="px-3 py-2 font-mono">{r.rank}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={r.llm}>
                        {r.llm}
                      </td>
                      {isMulti ? (
                        <td className="px-3 py-2 font-mono">
                          {r.queryCount != null ? r.queryCount : "—"}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 font-mono">
                        {typeof r.aggregatedScore === "number"
                          ? r.aggregatedScore.toFixed(4)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {typeof r.crossEncoderScore === "number"
                          ? r.crossEncoderScore.toFixed(4)
                          : typeof r.crossEncoderNorm === "number"
                            ? r.crossEncoderNorm.toFixed(4)
                            : "—"}
                      </td>
                      <td className="px-3 py-2 max-w-[140px]">
                        {r.usesSystemStats ? (
                          <span
                            className="text-emerald-700 dark:text-emerald-400"
                            title={
                              r.matchedStatLlm
                                ? `Matched DB name: ${r.matchedStatLlm}`
                                : "Used app model statistics"
                            }
                          >
                            Yes
                            {r.matchedStatLlm && r.matchedStatLlm !== r.llm ? (
                              <span className="block text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                → {r.matchedStatLlm}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default TrainingResultsModal
