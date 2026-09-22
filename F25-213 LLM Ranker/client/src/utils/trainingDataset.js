import * as XLSX from "xlsx"

const MAX_FILE_BYTES = 50 * 1024 * 1024

/** @typedef {{ id: string, llm: string, response: string }} TrainingRow */
/** @typedef {{ ok: true, query: string, rows: TrainingRow[], multiQuery?: false }} TrainingOkSingle */
/** @typedef {{ ok: true, runs: { query: string, rows: TrainingRow[], sheetName: string }[], multiQuery: true, skippedSheets?: { sheet: string, error: string }[] }} TrainingOkMulti */
/** @typedef {{ ok: false, error: string }} TrainingErr */

function normalizeCell(v) {
  if (v == null) return ""
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return String(v).trim()
}

function isEmptyRow(row) {
  if (!Array.isArray(row) || row.length === 0) return true
  return row.every((c) => !normalizeCell(c))
}

/** @returns {string[][]} */
export function sheetToGrid(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false })
  return Array.isArray(raw) ? raw.map((row) => (Array.isArray(row) ? row : []).map(normalizeCell)) : []
}

/**
 * Parse one Query … ID/LLM/Response block starting at row index `queryRowIndex`.
 * Stops before the next row whose first cell is "Query" or end of grid.
 */
function parseOneBlockFrom(grid, queryRowIndex, sheetLabel) {
  const qRow = grid[queryRowIndex]
  if (!Array.isArray(qRow) || normalizeCell(qRow[0]).toLowerCase() !== "query") {
    return {
      ok: false,
      error: sheetLabel
        ? `Sheet "${sheetLabel}" row ${queryRowIndex + 1}: expected a Query row.`
        : `Row ${queryRowIndex + 1}: expected a Query row.`,
    }
  }

  const queryText = qRow
    .slice(1)
    .map((c) => normalizeCell(c))
    .filter(Boolean)
    .join(" ")

  if (!queryText) {
    return {
      ok: false,
      error: sheetLabel
        ? `Sheet "${sheetLabel}": Query row must include query text.`
        : "Query row must include query text.",
    }
  }

  let headerRowIndex = -1
  let idCol = -1
  let llmCol = -1
  let respCol = -1

  for (let i = queryRowIndex + 1; i < grid.length; i++) {
    const row = grid[i]
    if (!Array.isArray(row) || row.length === 0) continue
    if (normalizeCell(row[0]).toLowerCase() === "query") {
      return {
        ok: false,
        error: sheetLabel
          ? `Sheet "${sheetLabel}": header row must appear before another Query (near row ${i + 1}).`
          : `Another Query appears before ID/LLM/Response header (row ${i + 1}).`,
      }
    }
    if (isEmptyRow(row)) continue

    const labels = row.map((c) => normalizeCell(c).toLowerCase())
    const idIdx = labels.indexOf("id")
    const llmIdx = labels.indexOf("llm")
    const respIdx = labels.indexOf("response")
    if (idIdx !== -1 && llmIdx !== -1 && respIdx !== -1) {
      headerRowIndex = i
      idCol = idIdx
      llmCol = llmIdx
      respCol = respIdx
      break
    }
  }

  if (headerRowIndex < 0) {
    return {
      ok: false,
      error: sheetLabel
        ? `Sheet "${sheetLabel}": missing ID / LLM / Response header after Query.`
        : 'Missing table header row with columns ID, LLM, and Response after Query.',
    }
  }

  /** @type {TrainingRow[]} */
  const rows = []
  let i = headerRowIndex + 1
  while (i < grid.length) {
    const row = grid[i]
    if (!Array.isArray(row)) {
      i += 1
      continue
    }
    if (normalizeCell(row[0]).toLowerCase() === "query") break
    if (isEmptyRow(row)) {
      i += 1
      continue
    }

    const id = normalizeCell(row[idCol])
    const llm = normalizeCell(row[llmCol])
    const response = normalizeCell(row[respCol])

    if (!llm || !response) {
      return {
        ok: false,
        error: sheetLabel
          ? `Sheet "${sheetLabel}" row ${i + 1}: each row needs LLM and Response.`
          : `Row ${i + 1}: each data row must have LLM and Response.`,
      }
    }
    rows.push({ id, llm, response })
    i += 1
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: sheetLabel
        ? `Sheet "${sheetLabel}": no data rows under ID / LLM / Response.`
        : "No data rows under the header.",
    }
  }

  return { ok: true, query: queryText, rows, nextStartIndex: i }
}

/**
 * All Query blocks in one grid (works for CSV and each Excel sheet).
 * @returns {{ ok: true, runs: { query: string, rows: TrainingRow[], sheetName: string }[] } | TrainingErr}
 */
export function extractAllRunsFromGrid(grid, sheetName = "") {
  let pos = 0
  /** @type { { query: string, rows: TrainingRow[], sheetName: string }[] } */
  const runs = []

  while (pos < grid.length) {
    while (pos < grid.length && isEmptyRow(grid[pos])) pos += 1
    if (pos >= grid.length) break

    const first = normalizeCell(grid[pos][0]).toLowerCase()
    if (first !== "query") {
      return {
        ok: false,
        error: sheetName
          ? `Sheet "${sheetName}" row ${pos + 1}: expected "Query" to start a block.`
          : `Row ${pos + 1}: expected "Query" to start a block.`,
      }
    }

    const block = parseOneBlockFrom(grid, pos, sheetName)
    if (!block.ok) return block

    runs.push({
      query: block.query,
      rows: block.rows,
      sheetName: sheetName || "Sheet1",
    })
    pos = block.nextStartIndex
  }

  if (runs.length === 0) {
    return { ok: false, error: "No Query blocks found." }
  }
  return { ok: true, runs }
}

/**
 * Single-sheet validation (same file may contain multiple Query blocks).
 * @returns {TrainingOkSingle | TrainingOkMulti | TrainingErr}
 */
export function validateTrainingGrid(grid) {
  const multi = extractAllRunsFromGrid(grid, "")
  if (!multi.ok) return multi
  if (multi.runs.length === 1) {
    const r = multi.runs[0]
    return { ok: true, query: r.query, rows: r.rows }
  }
  return {
    ok: true,
    runs: multi.runs.map((x) => ({
      query: x.query,
      rows: x.rows,
      sheetName: x.sheetName,
    })),
    multiQuery: true,
  }
}

/**
 * @param {string} text — pasted or raw CSV/TSV text
 */
export function parseTrainingText(text) {
  const raw = typeof text === "string" ? text.replace(/^\uFEFF/, "").trim() : ""
  if (!raw) {
    return { ok: false, error: "Paste is empty." }
  }
  try {
    const wb = XLSX.read(raw, { type: "string", raw: false })
    if (!wb?.SheetNames?.length) {
      return { ok: false, error: "Could not parse pasted content." }
    }
    const grid = sheetToGrid(wb.Sheets[wb.SheetNames[0]])
    return validateTrainingGrid(grid)
  } catch (e) {
    return {
      ok: false,
      error: `Could not parse tabular text: ${e?.message || "unknown error"}`,
    }
  }
}

/**
 * Read entire workbook: every sheet contributes Query blocks.
 * @returns {TrainingOkMulti | TrainingErr}
 */
export function parseWorkbookAllSheets(wb) {
  if (!wb?.SheetNames?.length) {
    return { ok: false, error: "Workbook has no sheets." }
  }

  /** @type { { query: string, rows: TrainingRow[], sheetName: string }[] } */
  const allRuns = []
  /** @type { { sheet: string, error: string }[] } */
  const skippedSheets = []

  for (const name of wb.SheetNames) {
    const grid = sheetToGrid(wb.Sheets[name])
    if (grid.length === 0 || grid.every((r) => isEmptyRow(r))) {
      skippedSheets.push({ sheet: name, error: "Empty sheet (skipped)." })
      continue
    }
    const r = extractAllRunsFromGrid(grid, name)
    if (!r.ok) {
      skippedSheets.push({ sheet: name, error: r.error })
      continue
    }
    for (const run of r.runs) {
      allRuns.push({
        query: run.query,
        rows: run.rows,
        sheetName: name,
      })
    }
  }

  if (allRuns.length === 0) {
    const detail = skippedSheets.map((s) => `${s.sheet}: ${s.error}`).join(" ")
    return {
      ok: false,
      error: `No valid Query blocks in any sheet. ${detail}`,
    }
  }

  return {
    ok: true,
    runs: allRuns,
    multiQuery: true,
    skippedSheets: skippedSheets.length ? skippedSheets : undefined,
  }
}

/**
 * @param {ArrayBuffer} buf
 * @param {string} fileName
 */
export function parseTrainingArrayBuffer(buf, fileName = "") {
  try {
    const wb = XLSX.read(buf, { type: "array", raw: false })
    const lower = (fileName || "").toLowerCase()
    const isXlsx =
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls") ||
      wb.SheetNames.length > 1

    if (isXlsx && wb.SheetNames.length >= 1) {
      const multi = parseWorkbookAllSheets(wb)
      if (multi.ok) return multi
      if (wb.SheetNames.length > 1) return multi
    }

    const grid = sheetToGrid(wb.Sheets[wb.SheetNames[0]])
    return validateTrainingGrid(grid)
  } catch (e) {
    return {
      ok: false,
      error: `Could not read spreadsheet: ${e?.message || "unknown error"}`,
    }
  }
}

/**
 * @param {File} file
 * @returns {Promise<TrainingOkSingle | TrainingOkMulti | TrainingErr>}
 */
export async function parseTrainingFile(file) {
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No file selected." }
  }
  const name = (file.name || "").toLowerCase()
  const isCsv = name.endsWith(".csv") || file.type === "text/csv"
  const isXlsx =
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"

  if (!isCsv && !isXlsx) {
    return { ok: false, error: "Only .csv or .xlsx files are allowed." }
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "File is too large. Maximum size is 50MB." }
  }

  const buf = await file.arrayBuffer()
  return parseTrainingArrayBuffer(buf, file.name || "")
}

export { MAX_FILE_BYTES }
