const RETRYABLE = new Set([429, 500, 502, 503, 504])

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 3,
  baseDelayMs = 2000,
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)))
    }
    try {
      const res = await fetch(url, init)
      if (!res.ok && RETRYABLE.has(res.status) && attempt < retries - 1) continue
      return res
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
