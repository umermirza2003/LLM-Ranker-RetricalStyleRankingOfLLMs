import { toPng } from "html-to-image"
import JSZip from "jszip"
import { downloadBlob } from "./trainingResultsExport"

/**
 * Capture every element under `root` with [data-training-chart-capture] as PNG and zip them.
 * @param {HTMLElement | null} root
 * @returns {Promise<{ ok: boolean, count: number, error?: string }>}
 */
export async function downloadTrainingChartsZip(root) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return { ok: false, count: 0, error: "Nothing to export." }
  }

  const nodes = [...root.querySelectorAll("[data-training-chart-capture]")]
  if (nodes.length === 0) {
    return { ok: false, count: 0, error: "No charts found to export." }
  }

  const zip = new JSZip()
  let captured = 0

  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i]
    const slug =
      el.getAttribute("data-training-chart-capture")?.trim() || `chart-${i}`
    const safe = slug.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "chart"

    try {
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        style: {
          transform: "none",
        },
      })
      const base64 = dataUrl.split(",")[1]
      if (base64) {
        zip.file(`${String(i).padStart(2, "0")}-${safe}.png`, base64, { base64: true })
        captured += 1
      }
    } catch (e) {
      console.warn("[trainingChartsExport] capture failed:", safe, e)
    }
  }

  if (captured === 0) {
    return { ok: false, count: 0, error: "Could not capture any chart images." }
  }

  const blob = await zip.generateAsync({ type: "blob" })
  downloadBlob(`llm-ranker-training-charts-${Date.now()}.zip`, blob)
  return { ok: true, count: captured }
}
