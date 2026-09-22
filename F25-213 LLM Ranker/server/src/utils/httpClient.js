async function postJsonWithRetry(url, headers, body, options) {
  const timeoutMs = options?.timeoutMs ?? 20000
  const retryCount = options?.retryCount ?? 0
  const retryOn = options?.retryOn ?? (() => false)

  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const err = new Error(`HTTP ${res.status} calling ${url}: ${text.slice(0, 300)}`)
        err.statusCode = res.status
        throw err
      }

      // Try json first; fall back to text for non-JSON providers.
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        return await res.json()
      }
      return await res.text()
    } catch (err) {
      const isAbort = String(err?.name || '').toLowerCase().includes('abort')

      const statusCode = err?.statusCode
      const shouldRetry =
        attempt <= retryCount + 1 && (isAbort || (typeof statusCode === 'number' && retryOn(statusCode)) || !statusCode)

      if (!shouldRetry) throw err

      // Exponential backoff: 200ms, 400ms, 800ms...
      const backoffMs = Math.min(200 * 2 ** (attempt - 1), 5000)
      await new Promise((r) => setTimeout(r, backoffMs))
    } finally {
      clearTimeout(timer)
    }
  }
}

module.exports = { postJsonWithRetry }

