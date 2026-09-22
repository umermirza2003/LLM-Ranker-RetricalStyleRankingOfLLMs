import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Activity, Loader2, MessageSquare, TrendingUp } from "lucide-react"
import { getApiBaseUrl } from "@/lib/apiBase"

function fmtPreviewScore(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return "—"
  if (n >= 0 && n <= 1 && n !== Math.floor(n)) return `${(n * 100).toFixed(1)}%`
  return n.toFixed(4)
}

function parseHistoryDate(createdAt) {
  const s = String(createdAt ?? "").trim()
  if (!s) return new Date()
  if (s.includes("T")) return new Date(s)
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) return new Date(`${s.replace(" ", "T")}Z`)
  return new Date(s)
}

function formatRelativeTime(createdAt) {
  const d = parseHistoryDate(createdAt)
  const ms = Date.now() - d.getTime()
  if (!Number.isFinite(ms)) return "—"
  const sec = Math.floor(ms / 1000)
  if (sec < 50) return "Just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 14) return `${day} days ago`
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function excerpt(q, max = 72) {
  const s = String(q ?? "").replace(/\s+/g, " ").trim()
  if (!s) return "—"
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

const DashboardPage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/dashboard-summary`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`)
        if (!cancelled) setData(payload)
      } catch (e) {
        if (!cancelled) setError(e?.message || "Could not load dashboard.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const totalBatches = typeof data?.totalBatches === "number" ? data.totalBatches : 0
  const maxPreviewScore = data?.maxPreviewScore
  const distinctLlm = typeof data?.distinctLlmCount === "number" ? data.distinctLlmCount : 0
  const recent = Array.isArray(data?.recentComparisons) ? data.recentComparisons : []

  return (
    <div className="page-padding">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview from your saved rankings (SQLite).</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Loading dashboard…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <Card>
              <CardHeader className="card-header-row">
                <CardTitle className="card-title-small">Ranked queries</CardTitle>
                <MessageSquare className="icon-small" />
              </CardHeader>
              <CardContent>
                <div className="stat-value">{totalBatches}</div>
                <p className="stat-label">Distinct batches in history</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="card-header-row">
                <CardTitle className="card-title-small">Highest preview score</CardTitle>
                <TrendingUp className="icon-small" />
              </CardHeader>
              <CardContent>
                <div className="stat-value">{fmtPreviewScore(maxPreviewScore)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="card-header-row">
                <CardTitle className="card-title-small">LLMs in data</CardTitle>
                <Activity className="icon-small" />
              </CardHeader>
              <CardContent>
                <div className="stat-value">{distinctLlm}</div>
                <p className="stat-label">Unique model names compared</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent comparisons</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No rankings yet. Run a query from <strong>Home</strong> to populate this list.
                </p>
              ) : (
                <div className="space-y-4">
                  {recent.map((row) => (
                    <div key={row.batchId} className="activity-item">
                      <div className="flex-1 min-w-0">
                        <p className="activity-action-text line-clamp-2">{excerpt(row.query, 120)}</p>
                        <p className="activity-model-text mt-1">
                          {typeof row.llm_count === "number" ? row.llm_count : 0} models
                          {row.best_llm_name ? (
                            <>
                              {" "}
                              · Top by score: <span className="font-medium">{row.best_llm_name}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <p className="activity-time-text shrink-0 ml-3">{formatRelativeTime(row.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default DashboardPage
