import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Award, BarChart3, Loader2, Trophy } from "lucide-react"
import { getApiBaseUrl } from "@/lib/apiBase"
import { cn } from "@/lib/utils"

function fmtScore(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  const n = Number(v)
  if (n >= 0 && n <= 1 && n !== Math.floor(n)) return n.toFixed(4)
  return n.toFixed(4)
}

const ModelStatisticsPage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/model-statistics`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
        if (!cancelled) setPayload(data)
      } catch (e) {
        if (!cancelled) setError(e?.message || "Could not load statistics.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const models = Array.isArray(payload?.models) ? payload.models : []
  const best = payload?.bestModel
  const batchCount = typeof payload?.batchCount === "number" ? payload.batchCount : 0

  return (
    <div className="page-padding">
      <div className="mb-8">
        <h1 className="page-title flex flex-wrap items-center gap-2">
          <BarChart3 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" aria-hidden />
          Model statistics
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Loading statistics…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : batchCount === 0 || models.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No ranked batches yet. Run comparisons from <strong>Home</strong> to build statistics.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card className="border-amber-200/80 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/25">
              <CardHeader className="card-header-row">
                <CardTitle className="card-title-small flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Best-performing model
                </CardTitle>
                <Award className="icon-small text-amber-600" />
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {best?.llm ?? "—"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Most often ranked first in your preferred order ({best?.timesRankedFirst ?? 0} of{" "}
                  {best?.queriesWithModel ?? 0} queries with this model
                  {batchCount ? ` · ${batchCount} total batches in database` : ""}).
                </p>
                {best && (
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">Avg preview</dt>
                      <dd className="font-mono font-medium">{fmtScore(best.avgPreviewScore)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Avg rank score</dt>
                      <dd className="font-mono font-medium">{fmtScore(best.avgRankScore)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Combined</dt>
                      <dd className="font-mono font-medium">{fmtScore(best.combinedScore)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Times #1</dt>
                      <dd className="font-mono font-medium">{best.timesRankedFirst}</dd>
                    </div>
                  </dl>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="card-title-small">Dataset</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">{batchCount}</span> ranked batches
                  analyzed.
                </p>
                <p className="mt-2">
                  Models are sorted by <strong>times at rank #1</strong>, then by combined score (avg
                  preview + avg rank score).
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="card-title-small">All models</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:p-6">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left dark:border-gray-700 dark:bg-gray-800/80">
                    <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Model</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Times #1</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Queries</th>
                    <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      Avg preview score
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      Avg rank score
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Combined</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m, i) => (
                    <tr
                      key={m.llm}
                      className={cn(
                        "border-b border-gray-100 dark:border-gray-700/80",
                        i === 0 && "bg-amber-50/40 dark:bg-amber-950/15",
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{m.llm}</td>
                      <td className="px-4 py-3 tabular-nums">{m.timesRankedFirst}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{m.queriesWithModel}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{fmtScore(m.avgPreviewScore)}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{fmtScore(m.avgRankScore)}</td>
                      <td className="px-4 py-3 font-mono tabular-nums font-semibold">
                        {fmtScore(m.combinedScore)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default ModelStatisticsPage
