export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

const CAMERAS: Record<string, string> = {
  "grand-place": "https://www.bruxelles.be/webcam-grand-place",
  "brouckere":   "https://www.bruxelles.be/webcam-place-de-brouckere",
}

const cache: Record<string, { proxied: string; expiresAt: number }> = {}

async function fetchStreamUrl(pageUrl: string): Promise<string | null> {
  const res = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    cache: "no-store",
  })
  if (!res.ok) return null
  const html = await res.text()
  const match = html.match(/livecam\.brucity\.be[^"'\s<>]+\.m3u8/)
  if (!match) return null
  return "https://" + match[0].replace(/\\\//g, "/")
}

export async function GET(req: NextRequest) {
  const cam = req.nextUrl.searchParams.get("cam") ?? "grand-place"
  const pageUrl = CAMERAS[cam]
  if (!pageUrl) return NextResponse.json({ error: "unknown camera" }, { status: 400 })

  try {
    const entry = cache[cam]
    if (!entry || Date.now() > entry.expiresAt) {
      const streamUrl = await fetchStreamUrl(pageUrl)
      if (!streamUrl) return NextResponse.json({ error: "stream not found" }, { status: 404 })
      cache[cam] = {
        proxied: `/api/webcam/stream?url=${encodeURIComponent(streamUrl)}`,
        expiresAt: Date.now() + 30 * 60 * 1000,
      }
    }
    return NextResponse.json({ streamUrl: cache[cam].proxied })
  } catch (e) {
    console.error("[webcam]", e)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
