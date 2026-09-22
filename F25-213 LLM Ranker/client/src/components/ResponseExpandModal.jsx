import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft } from "lucide-react"

/**
 * Full response overlay (scoped to viewport via portal — avoids clipping in scroll panels).
 */
function ResponseExpandModal({ open, modelName, responseText, onClose }) {
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

  if (!open) return null

  const body = typeof responseText === "string" ? responseText.trim() || "—" : "—"

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px] dark:bg-black/60"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="response-expand-title"
        className="relative flex max-h-[min(560px,85vh)] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl outline-none dark:bg-slate-950 dark:ring-1 dark:ring-slate-700/80"
      >
        <header className="relative flex shrink-0 items-center border-b border-gray-200 px-10 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-slate-800"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2
            id="response-expand-title"
            className="w-full text-center text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50"
          >
            Response
          </h2>
        </header>
        {modelName ? (
          <p className="shrink-0 border-b border-gray-100 px-6 py-2 text-xs font-medium text-indigo-600 dark:border-slate-800 dark:text-indigo-400">
            {modelName}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4 sm:px-4">
          <div className="border-l-2 border-indigo-200 pl-4 pr-3 dark:border-indigo-500/40">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800 dark:text-gray-100">
              {body}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ResponseExpandModal
