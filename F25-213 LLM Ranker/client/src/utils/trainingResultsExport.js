import * as XLSX from "xlsx"

/**
 * @param {object} result - API /api/dataset-train response
 * @returns {string}
 */
export function buildTrainingResultsCsv(result) {
  if (!result) return ""

  if (result.multiQuery === true && Array.isArray(result.flatRows)) {
    const lines = []
    lines.push("LLM Ranker — multi-query training")
    lines.push(`Query_count,${result.queryCount ?? ""}`)
    lines.push(`Summary_label,"${String(result.query || "").replace(/"/g, '""')}"`)
    lines.push(
      `Blend (CrossEncoder weight),${typeof result.blendWeight === "number" ? result.blendWeight : ""}`,
    )
    lines.push("")
    lines.push("=== Mean ranking across queries ===")
    lines.push(
      ["Rank", "LLM", "Queries graded", "Mean aggregated", "Mean CE norm"].join(","),
    )
    for (const r of result.rows || []) {
      lines.push(
        [
          r.rank,
          `"${String(r.llm).replace(/"/g, '""')}"`,
          r.queryCount ?? "",
          r.aggregatedScore,
          r.crossEncoderNorm,
        ].join(","),
      )
    }
    lines.push("")
    lines.push("=== Every query × LLM row ===")
    const flatH = [
      "Sheet",
      "Query_index",
      "Query",
      "Rank",
      "ID",
      "LLM",
      "Matched app LLM",
      "Aggregated score",
      "CrossEncoder score",
      "CrossEncoder norm",
      "System combined",
      "System norm",
      "Uses system stats",
    ]
    lines.push(flatH.join(","))
    for (const r of result.flatRows) {
      lines.push(
        [
          `"${String(r.sheetName ?? "").replace(/"/g, '""')}"`,
          r.queryIndex,
          `"${String(r.query ?? "").replace(/"/g, '""')}"`,
          r.rank,
          r.id,
          `"${String(r.llm).replace(/"/g, '""')}"`,
          r.matchedStatLlm != null ? `"${String(r.matchedStatLlm).replace(/"/g, '""')}"` : "",
          r.aggregatedScore,
          r.crossEncoderScore,
          r.crossEncoderNorm,
          r.systemCombinedScore ?? "",
          r.systemNorm ?? "",
          r.usesSystemStats ? "yes" : "no",
        ].join(","),
      )
    }
    return lines.join("\n")
  }

  if (!result?.query || !Array.isArray(result.rows)) return ""
  const lines = []
  lines.push("LLM Ranker — training run")
  lines.push(`Query,"${String(result.query).replace(/"/g, '""')}"`)
  lines.push(
    `Blend (CrossEncoder weight),${typeof result.blendWeight === "number" ? result.blendWeight : ""}`,
  )
  lines.push("")

  const h = [
    "Rank",
    "ID",
    "LLM",
    "Matched app LLM",
    "Aggregated score",
    "CrossEncoder score",
    "CrossEncoder norm",
    "System combined",
    "System norm",
    "Uses system stats",
  ]
  lines.push(h.join(","))

  for (const r of result.rows) {
    const row = [
      r.rank,
      r.id,
      `"${String(r.llm).replace(/"/g, '""')}"`,
      r.matchedStatLlm != null ? `"${String(r.matchedStatLlm).replace(/"/g, '""')}"` : "",
      r.aggregatedScore,
      r.crossEncoderScore,
      r.crossEncoderNorm,
      r.systemCombinedScore ?? "",
      r.systemNorm ?? "",
      r.usesSystemStats ? "yes" : "no",
    ]
    lines.push(row.join(","))
  }

  return lines.join("\n")
}

/**
 * @param {object} result
 * @returns {import('xlsx').WorkBook}
 */
export function buildTrainingResultsWorkbook(result) {
  const wb = XLSX.utils.book_new()

  const d = result.systemStatsDetail
  const meta = [
    ["Label", result.multiQuery ? "Multi-query training" : "Single-query training"],
    ["Query / summary", result.query || ""],
    ...(result.multiQuery === true
      ? [["Query count", result.queryCount ?? ""]]
      : []),
    ["Blend weight (CrossEncoder share)", result.blendWeight ?? ""],
    ["CrossEncoder mode", result.crossEncoderMode ?? "live"],
    ["System stats used (batch)", result.systemStatsAvailable ? "yes" : "no"],
    ["DB batch count", d?.dbBatchCount ?? ""],
    ["Models with score in DB", d?.modelsWithScore ?? ""],
    ["Upload rows matched app stats", d?.uploadRowsMatchedSystem ?? ""],
    ...(d?.totalRowsGraded != null ? [["Total graded rows", d.totalRowsGraded]] : []),
    ["Best model (global stats)", result.bestSystemModel?.llm ?? ""],
    ["Generated (UTC)", new Date().toISOString()],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Summary")

  if (result.multiQuery === true && Array.isArray(result.flatRows)) {
    const meanHeader = ["Rank", "LLM", "Queries graded", "Mean aggregated", "Mean CE norm"]
    const meanRows = (result.rows || []).map((r) => [
      r.rank,
      r.llm,
      r.queryCount ?? "",
      r.aggregatedScore,
      r.crossEncoderNorm,
    ])
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([meanHeader, ...meanRows]),
      "Mean_rankings",
    )

    const flatHeader = [
      "Sheet",
      "Query index",
      "Query",
      "Rank",
      "ID",
      "LLM",
      "Matched app LLM",
      "Aggregated score",
      "CrossEncoder score",
      "CrossEncoder norm",
      "System combined",
      "System norm",
      "Uses system stats",
      "Response (truncated)",
    ]
    const flatData = result.flatRows.map((r) => [
      r.sheetName ?? "",
      r.queryIndex,
      r.query ?? "",
      r.rank,
      r.id,
      r.llm,
      r.matchedStatLlm ?? "",
      r.aggregatedScore,
      r.crossEncoderScore,
      r.crossEncoderNorm,
      r.systemCombinedScore ?? "",
      r.systemNorm ?? "",
      r.usesSystemStats ? "yes" : "no",
      typeof r.response === "string" ? r.response.slice(0, 500) : "",
    ])
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([flatHeader, ...flatData]),
      "All_queries",
    )
    return wb
  }

  const header = [
    "Rank",
    "ID",
    "LLM",
    "Matched app LLM",
    "Aggregated score",
    "CrossEncoder score",
    "CrossEncoder norm",
    "System combined",
    "System norm",
    "Uses system stats",
    "Response (truncated)",
  ]

  const dataRows = (result.rows || []).map((r) => [
    r.rank,
    r.id,
    r.llm,
    r.matchedStatLlm ?? "",
    r.aggregatedScore,
    r.crossEncoderScore,
    r.crossEncoderNorm,
    r.systemCombinedScore ?? "",
    r.systemNorm ?? "",
    r.usesSystemStats ? "yes" : "no",
    typeof r.response === "string" ? r.response.slice(0, 500) : "",
  ])

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows])
  XLSX.utils.book_append_sheet(wb, ws, "Rankings")

  return wb
}

export function downloadBlob(filename, blob) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function downloadTrainingCsv(result) {
  const csv = buildTrainingResultsCsv(result)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  downloadBlob(`llm-ranker-training-${Date.now()}.csv`, blob)
}

export function downloadTrainingXlsx(result) {
  const wb = buildTrainingResultsWorkbook(result)
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  downloadBlob(`llm-ranker-training-${Date.now()}.xlsx`, blob)
}
