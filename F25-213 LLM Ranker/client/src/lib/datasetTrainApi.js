import { getApiBaseUrl } from "./apiBase"

/**
 * POST dataset train — tries `/api/dataset-train` then `/dataset-train` so older servers
 * or proxy quirks still work.
 * @returns {{ res: Response, rawText: string }}
 */
export async function postDatasetTrain(body) {
  const base = getApiBaseUrl().replace(/\/$/, "")
  const urls = [`${base}/api/dataset-train`, `${base}/dataset-train`]
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }

  let lastRes = null
  let lastText = ""

  for (const url of urls) {
    const res = await fetch(url, init)
    const rawText = await res.text()
    lastRes = res
    lastText = rawText
    if (res.status !== 404) {
      return { res, rawText }
    }
  }

  return { res: lastRes, rawText: lastText }
}
