function normalizeWhitespace(s) {
  return String(s).replace(/\s+/g, ' ').trim()
}

function extractAnswerFromQueryAnswerFormat(text) {
  const s = String(text ?? '').trim()
  if (!s) return null

  // One line or many: "query: … answer: …" (forced format from provider prompt).
  const noPreamble = s.replace(/^query\s*:[\s\S]*?\banswer\s*:\s*/i, '').trim()
  if (noPreamble !== s && noPreamble.length > 0) {
    let body = noPreamble.replace(/\n\s*(?:query|question)\s*:\s*[\s\S]*$/i, '').trim()
    return normalizeWhitespace(body)
  }

  // Prefer everything after explicit "answer:" when query line is missing or odd layout.
  const afterAnswer = /\banswer\s*:\s*([\s\S]*)/i.exec(s)
  if (afterAnswer && afterAnswer[1].trim()) {
    let body = afterAnswer[1].trim()
    body = body.replace(/\n\s*(?:query|question)\s*:\s*[\s\S]*$/i, '').trim()
    return normalizeWhitespace(body)
  }

  // Leading query:/question: lines only (no labelled answer).
  const stripped = s.replace(/^(\s*(?:query|question)\s*:\s*[^\n]*(?:\s*\n|$))+/, '').trim()
  return stripped !== s && stripped.length > 0 ? normalizeWhitespace(stripped) : null
}

/**
 * Tries to extract a human-readable text response from varied API payloads.
 * Supports:
 * - JSON { response: "..." } / { text: "..." } / { result: "..." } / { answer: "..." }
 * - JSON { responses: ["..."] } (first element)
 * - Raw string response
 */
function extractTextFromAnyApiResponse(apiResult, { responseJsonPath } = {}) {
  if (apiResult == null) return ''

  if (typeof apiResult === 'string') {
    const extracted = extractAnswerFromQueryAnswerFormat(apiResult)
    return extracted ?? normalizeWhitespace(apiResult)
  }

  if (typeof apiResult === 'object') {
    // Gemini JSON response heuristic:
    // { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    const geminiText = apiResult?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof geminiText === 'string' && geminiText.trim().length > 0) {
      const extracted = extractAnswerFromQueryAnswerFormat(geminiText)
      return normalizeWhitespace(extracted ?? geminiText)
    }

    // Optional extraction via env-provided dot-path (e.g., "choices.0.message.content")
    if (responseJsonPath) {
      const parts = responseJsonPath.split('.').filter(Boolean)
      let curr = apiResult
      for (const part of parts) {
        const num = Number(part)
        const key = Number.isFinite(num) && String(num) === part ? num : part
        curr = curr?.[key]
      }
      if (typeof curr === 'string' || typeof curr === 'number' || curr == null) {
        const str = String(curr ?? '').trim()
        if (!str) return ''
        const extracted = extractAnswerFromQueryAnswerFormat(str)
        return extracted ?? normalizeWhitespace(str)
      }
    }

    const candidates = [
      apiResult.response,
      apiResult.text,
      apiResult.result,
      apiResult.answer,
      apiResult.output,
    ]
    const firstString = candidates.find((c) => typeof c === 'string' && c.trim().length > 0)
    if (firstString) {
      const extracted = extractAnswerFromQueryAnswerFormat(firstString)
      return normalizeWhitespace(extracted ?? firstString)
    }

    if (Array.isArray(apiResult.responses) && apiResult.responses.length > 0) {
      const first = apiResult.responses.find((x) => typeof x === 'string')
      if (first) {
        const extracted = extractAnswerFromQueryAnswerFormat(first)
        return normalizeWhitespace(extracted ?? first)
      }
    }

    // If the payload isn't in a known shape, stringify it to preserve info.
    return normalizeWhitespace(extractAnswerFromQueryAnswerFormat(JSON.stringify(apiResult)) ?? JSON.stringify(apiResult))
  }

  return normalizeWhitespace(String(apiResult))
}

module.exports = { extractTextFromAnyApiResponse, extractAnswerFromQueryAnswerFormat }

