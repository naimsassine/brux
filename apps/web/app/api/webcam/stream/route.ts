import { NextRequest, NextResponse } from "next/server"

const UPSTREAM_ORIGIN = "https://www.bruxelles.be"
const UPSTREAM_HEADERS = {
  Origin: UPSTREAM_ORIGIN,
  Referer: `${UPSTREAM_ORIGIN}/`,
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-cache, no-store",
}

// Rewrite all non-comment, non-empty lines (segment URLs) to route through our proxy.
// Handles both relative URLs and absolute URLs in the playlist.
function rewritePlaylist(content: string, playlistUrl: string): string {
  const base = new URL(playlistUrl)
  const baseDir = base.href.slice(0, base.href.lastIndexOf("/") + 1)

  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed === "" || trimmed.startsWith("#")) return line
      const absolute = trimmed.startsWith("http") ? trimmed : new URL(trimmed, baseDir).href
      return `/api/webcam/stream?url=${encodeURIComponent(absolute)}`
    })
    .join("\n")
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")
  if (!rawUrl) return NextResponse.json({ error: "missing url" }, { status: 400 })

  const targetUrl = decodeURIComponent(rawUrl)

  let upstream: Response
  try {
    upstream = await fetch(targetUrl, { headers: UPSTREAM_HEADERS, cache: "no-store" })
  } catch (e) {
    console.error("[webcam/stream] fetch error", e)
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 })
  }

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status, headers: CORS_HEADERS })
  }

  const isPlaylist = targetUrl.endsWith(".m3u8") || (upstream.headers.get("content-type") ?? "").includes("mpegurl")

  if (isPlaylist) {
    const text = await upstream.text()
    const rewritten = rewritePlaylist(text, targetUrl)
    return new NextResponse(rewritten, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/vnd.apple.mpegurl" },
    })
  }

  // Video segment — stream the bytes through unchanged
  const buffer = await upstream.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": upstream.headers.get("content-type") ?? "video/MP2T",
    },
  })
}
