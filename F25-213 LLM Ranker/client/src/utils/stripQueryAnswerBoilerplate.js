/**
 * Remove forced "query: … answer: …" scaffolding from model text (preview + modal).
 * Mirrors server-side normalization for rows stored before the extractor fix.
 */
export function stripQueryAnswerBoilerplate(raw) {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim()
  if (!s) return s
  const noPrelude = s.replace(/^query\s*:[\s\S]*?\banswer\s*:\s*/i, "").trim()
  if (noPrelude !== s && noPrelude.length > 0) {
    return noPrelude.replace(/\n\s*(?:query|question)\s*:\s*[\s\S]*$/i, "").trim()
  }
  const m = /\banswer\s*:\s*([\s\S]*)/i.exec(s)
  if (m && m[1].trim()) {
    return m[1].trim().replace(/\n\s*(?:query|question)\s*:\s*[\s\S]*$/i, "").trim()
  }
  return s.replace(/^(\s*(?:query|question)\s*:\s*[^\n]*(?:\s*\n|$))+/, "").trim() || s
}
