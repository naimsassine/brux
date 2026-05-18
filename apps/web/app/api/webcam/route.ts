import { NextResponse } from "next/server"

const PAGE_URL = "https://www.bruxelles.be/webcam-grand-place"

// Cached so we don't hammer the page on every request
let cachedProxied: string | null = null
let cacheExpiresAt = 0

async function fetchStreamUrl(): Promise<string | null> {
  const res = await fetch(PAGE_URL, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    cache: "no-store",
  })
  if (!res.ok) return null
  const html = await res.text()
  const match = html.match(/livecam\.brucity\.be[^"'\s<>]+\.m3u8/)
  if (!match) return null
  return "https://" + match[0].replace(/\\\//g, "/")
}

export async function GET() {
  try {
    if (!cachedProxied || Date.now() > cacheExpiresAt) {
      const streamUrl = await fetchStreamUrl()
      if (!streamUrl) return NextResponse.json({ error: "stream not found" }, { status: 404 })
      cachedProxied = `/api/webcam/stream?url=${encodeURIComponent(streamUrl)}`
      cacheExpiresAt = Date.now() + 30 * 60 * 1000 // 30 min
    }
    return NextResponse.json({ streamUrl: cachedProxied })
  } catch (e) {
    console.error("[webcam]", e)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
