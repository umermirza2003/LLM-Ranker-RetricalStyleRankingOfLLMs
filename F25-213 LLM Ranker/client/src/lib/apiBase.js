/**
 * Base URL for the Node ranking API (never include credentials here).
 * In dev, default is '' so fetch hits the Vite dev server proxy (see vite.config.js).
 */
export function getApiBaseUrl() {
  const v = import.meta.env.VITE_API_BASE_URL
  if (v && typeof v === "string" && v.trim().length > 0) return v.replace(/\/$/, "")
  if (import.meta.env.DEV) return ""
  return "http://127.0.0.1:5000"
}
