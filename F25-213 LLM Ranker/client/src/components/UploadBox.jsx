import { useState, useRef, useCallback } from "react"
import { Plus, Clipboard, FileSpreadsheet, AlertCircle, X } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import {
  parseTrainingFile,
  parseTrainingText,
  MAX_FILE_BYTES,
} from "@/utils/trainingDataset"

function formatFileSize(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * @param {(payload: {
 *   query: string
 *   rows: { id: string, llm: string, response: string }[]
 * } | {
 *   multiQuery: true
 *   runs: { query: string, rows: { id: string, llm: string, response: string }[], sheetName?: string }[]
 *   skippedSheets?: { sheet: string, error: string }[]
 * } | null) => void} [onTrainingDataChange]
 */
const UploadBox = ({ onTrainingDataChange }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [successSummary, setSuccessSummary] = useState(null)
  /** Shown inside the dashed zone when parse succeeds */
  const [acceptedSource, setAcceptedSource] = useState(null)
  const fileInputRef = useRef(null)

  const emitInvalid = useCallback(
    (message) => {
      setParseError(message)
      setSuccessSummary(null)
      setAcceptedSource(null)
      onTrainingDataChange?.(null)
    },
    [onTrainingDataChange],
  )

  const emitValid = useCallback(
    (data, source) => {
      setParseError(null)
      setAcceptedSource(source ?? null)
      if (data.multiQuery === true && Array.isArray(data.runs)) {
        const totalRows = data.runs.reduce((acc, r) => acc + (r.rows?.length ?? 0), 0)
        const firstQ = data.runs[0]?.query ?? ""
        onTrainingDataChange?.({
          multiQuery: true,
          runs: data.runs,
          skippedSheets: data.skippedSheets,
        })
        setSuccessSummary({
          multi: true,
          runCount: data.runs.length,
          count: totalRows,
          queryPreview: firstQ.length > 120 ? `${firstQ.slice(0, 118)}…` : firstQ,
          skippedSheets: data.skippedSheets,
        })
      } else {
        setSuccessSummary({
          multi: false,
          queryPreview:
            data.query.length > 120 ? `${data.query.slice(0, 120)}…` : data.query,
          count: data.rows.length,
        })
        onTrainingDataChange?.({ query: data.query, rows: data.rows })
      }
    },
    [onTrainingDataChange],
  )

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const processFiles = useCallback(
    async (files) => {
      if (!files?.length) return
      const file = files[0]
      const result = await parseTrainingFile(file)
      if (result.ok) {
        emitValid(result, { kind: "file", name: file.name, size: file.size })
      } else {
        emitInvalid(result.error)
      }
    },
    [emitInvalid, emitValid],
  )

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  const handleFileSelect = (e) => {
    processFiles(e.target.files)
    e.target.value = ""
  }

  const handleRemoveLoaded = useCallback(() => {
    setSuccessSummary(null)
    setAcceptedSource(null)
    setParseError(null)
    onTrainingDataChange?.(null)
  }, [onTrainingDataChange])

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const result = parseTrainingText(text)
      if (result.ok) {
        emitValid(result, { kind: "paste" })
      } else {
        emitInvalid(result.error)
      }
    } catch (err) {
      console.error("Paste failed:", err)
      emitInvalid(
        err?.name === "NotAllowedError"
          ? "Clipboard access was denied. Allow paste or use Choose a file."
          : "Could not read from the clipboard.",
      )
    }
  }

  return (
    <div className="upload-box-container">
      <p className="upload-box-description">
        Training data must be a <strong>.csv</strong> or <strong>.xlsx</strong> file, or the same
        table pasted from Excel. Only this layout is accepted:
      </p>
      <ul className="upload-format-rules mb-3 list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <li>
          Row with <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">Query</code>{" "}
          in the first column and the query text in the following columns.
        </li>
        <li>
          A header row with columns <strong>ID</strong>, <strong>LLM</strong>, and{" "}
          <strong>Response</strong> (any order).
        </li>
        <li>
          Any number of rows—one per LLM response. If the layout differs, training is disabled.
        </li>
      </ul>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "upload-drop-zone-base flex flex-col items-center",
          isDragging ? "upload-drop-zone-dragging" : "upload-drop-zone-default",
        )}
      >
        <FileSpreadsheet className="upload-icon" />
        <p className="upload-title-text">Drag and drop CSV or XLSX training data</p>
        <p className="upload-hint-text">
          Use the required Query row and ID / LLM / Response table. Messy or unrelated formats will
          be rejected.
        </p>
        <p className={cn("upload-limit-text", successSummary && acceptedSource ? "mb-4" : "mb-6")}>
          CSV / XLSX files: max {(MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)}MB
        </p>

        <div className="upload-divider-container">
          <div className="upload-divider-line" />
          <span className="upload-divider-text">OR</span>
          <div className="upload-divider-line" />
        </div>

        <div className="upload-actions-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="button-icon-text"
          >
            <Plus className="w-4 h-4" />
            Choose a File
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handlePaste}
            className="button-icon-text dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 dark:border-gray-600"
          >
            <Clipboard className="w-4 h-4" />
            Paste
          </Button>
        </div>

        {successSummary && acceptedSource && (
          <div className="mt-6 w-full max-w-lg rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-left shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 relative pr-10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                Loaded dataset
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveLoaded()
              }}
              className="absolute right-1 top-1 h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/50"
              aria-label="Remove loaded dataset"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-start gap-3">
              {acceptedSource.kind === "file" ? (
                <FileSpreadsheet className="w-9 h-9 shrink-0 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <Clipboard className="w-9 h-9 shrink-0 text-emerald-700 dark:text-emerald-300" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm"
                  title={acceptedSource.kind === "file" ? acceptedSource.name : "Clipboard paste"}
                >
                  {acceptedSource.kind === "file" ? acceptedSource.name : "Clipboard paste"}
                </p>
                {acceptedSource.kind === "file" && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(acceptedSource.size)}</p>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  {successSummary.multi ? (
                    <>
                      {successSummary.runCount} quer
                      {successSummary.runCount === 1 ? "y" : "ies"} · {successSummary.count} LLM
                      response{successSummary.count === 1 ? "" : "s"}
                    </>
                  ) : (
                    <>
                      {successSummary.count} LLM response{successSummary.count === 1 ? "" : "s"}
                    </>
                  )}
                </p>
                {successSummary.multi ? (
                  <p
                    className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-snug line-clamp-2"
                    title={successSummary.queryPreview}
                  >
                    First query: {successSummary.queryPreview || "—"}
                  </p>
                ) : (
                  <p
                    className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-snug line-clamp-3"
                    title={successSummary.queryPreview}
                  >
                    Query: {successSummary.queryPreview}
                  </p>
                )}
                {successSummary.multi &&
                Array.isArray(successSummary.skippedSheets) &&
                successSummary.skippedSheets.length > 0 ? (
                  <p className="text-[10px] text-amber-800 dark:text-amber-200/90 mt-1">
                    Skipped {successSummary.skippedSheets.length} sheet
                    {successSummary.skippedSheets.length === 1 ? "" : "s"} (empty or invalid layout).
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {parseError && (
        <div
          className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

    </div>
  )
}

export default UploadBox
