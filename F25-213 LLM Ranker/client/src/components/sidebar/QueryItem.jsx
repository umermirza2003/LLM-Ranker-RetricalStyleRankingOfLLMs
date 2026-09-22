import { cn } from "@/lib/utils"
import { Clock, TrendingUp } from "lucide-react"

const QueryItem = ({ query, isActive, onClick }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMs < 60_000) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "query-item-container",
        isActive && "bg-gray-200 dark:bg-slate-700 border-l-4 border-indigo-500 dark:border-indigo-400 font-semibold"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span className={cn(
            "text-sm line-clamp-2 flex-1",
            isActive ? "font-semibold text-gray-900 dark:text-white" : "font-medium"
          )}>
            {query.query}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDate(query.date)}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>{query.llmCount} LLMs</span>
          </div>
          {query.bestLLM && (
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">
              Best: {query.bestLLM}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default QueryItem

