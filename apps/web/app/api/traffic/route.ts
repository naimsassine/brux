export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import OpenAI from "openai"

const TIMELINE_URL =
  "https://info.mobilite-mobiliteit.brussels/api/v1/timelines/public?local=true&limit=20"

export interface TrafficAlert {
  id: string
  content: string
  createdAt: string
  location: string | null
  lat: number | null
  lng: number | null
}

// Survives across requests in the same Node.js process
const geoCache = new Map<string, { location: string | null; lat: number | null; lng: number | null }>()

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

async function geocode(
  text: string,
  client: OpenAI,
): Promise<{ location: string | null; lat: number | null; lng: number | null }> {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: `Extract the location from this Brussels traffic alert and return the approximate WGS84 coordinates. Respond with JSON only, no explanation: {"location":"street or area name","lat":50.85,"lng":4.35}. If no specific location can be identified, return {"location":null,"lat":null,"lng":null}.\n\nAlert: ${text}`,
        },
      ],
    })
    const raw = completion.choices[0]?.message?.content?.trim() ?? ""
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { location: null, lat: null, lng: null }
    const json = JSON.parse(match[0])
    const lat = typeof json.lat === "number" ? json.lat : null
    const lng = typeof json.lng === "number" ? json.lng : null
    // Basic sanity check: must be inside Brussels region
    if (lat !== null && (lat < 50.75 || lat > 50.95 || lng < 4.2 || lng > 4.55)) {
      return { location: json.location ?? null, lat: null, lng: null }
    }
    return { location: json.location ?? null, lat, lng }
  } catch {
    return { location: null, lat: null, lng: null }
  }
}

export async function GET() {
  try {
    const res = await fetch(TIMELINE_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("[traffic] upstream error", res.status)
      return NextResponse.json({ error: "upstream failed" }, { status: 502 })
    }

    const posts: any[] = await res.json()

    // Keep French posts only — each event is duplicated in FR + NL
    const frPosts = posts.filter((p) => p.language === "fr")

    const client = new OpenAI()

    const alerts: TrafficAlert[] = await Promise.all(
      frPosts.map(async (post) => {
        const content = stripHtml(post.content)

        let geo = geoCache.get(post.id)
        if (!geo) {
          geo = await geocode(content, client)
          geoCache.set(post.id, geo)
        }

        return {
          id: post.id,
          content,
          createdAt: post.created_at,
          location: geo.location,
          lat: geo.lat,
          lng: geo.lng,
        }
      }),
    )

    console.log(
      `[traffic] ${alerts.length} alerts, ${alerts.filter((a) => a.lat).length} geocoded`,
    )

    return NextResponse.json(alerts, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" },
    })
  } catch (e) {
    console.error("[traffic]", e)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
