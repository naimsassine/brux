export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import https from "https"

const UPSTREAM_ORIGIN = "https://www.bruxelles.be"

// livecam.brucity.be has a cert Node's CA bundle can't verify — scope the
// bypass to just these upstream requests via a custom https.Agent.
const insecureAgent = new https.Agent({ rejectUnauthorized: false })

function fetchInsecure(url: string, headers: Record<string, string>): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { agent: insecureAgent, headers }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => {
        const body = Buffer.concat(chunks)
        const resHeaders: Record<string, string> = {}
        for (const [k, v] of Object.entries(res.headers)) {
          if (v) resHeaders[k] = Array.isArray(v) ? v.join(", ") : v
        }
        resolve(new Response(body, { status: res.statusCode ?? 200, headers: resHeaders }))
      })
      res.on("error", reject)
    })
    req.on("error", reject)
    req.end()
  })
}
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
    upstream = await fetchInsecure(targetUrl, UPSTREAM_HEADERS)
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
