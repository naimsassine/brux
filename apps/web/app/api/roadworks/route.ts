import { NextResponse } from "next/server"

const PAGE_URL = "https://be.brussels/fr/info-trafic"

const FETCH_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
  "cache-control": "max-age=0",
  cookie: "NEXT_LOCALE=fr",
  dnt: "1",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
}

export interface Worksite {
  nid: number
  title: string
  summary: string | null
  status: string | null
  timing: string | null
  municipalities: string[]
  manager: string | null
  disruptions: string | null
  url: string | null
  lat: number
  lng: number
}

// The page embeds all data as a JSON string inside self.__next_f.push([1, "..."]).
// We find the push call that contains the Elasticsearch worksite data and decode it.
function decodeRscChunk(html: string): string | null {
  const marker = "worksite_prod"
  const markerIdx = html.indexOf(marker)
  if (markerIdx === -1) return null

  const pushStart = html.lastIndexOf("self.__next_f.push([1,", markerIdx)
  if (pushStart === -1) return null

  const quoteStart = html.indexOf('"', pushStart + "self.__next_f.push([1,".length) + 1

  const chars: string[] = []
  let i = quoteStart
  while (i < html.length) {
    if (html[i] === "\\") {
      chars.push(html[i], html[i + 1])
      i += 2
    } else if (html[i] === '"') {
      break
    } else {
      chars.push(html[i])
      i++
    }
  }

  try {
    return JSON.parse('"' + chars.join("") + '"')
  } catch {
    return null
  }
}

// Walk the RSC text and extract every JSON object that follows "_source":
function extractSources(rsc: string): any[] {
  const results: any[] = []
  let pos = 0

  while (true) {
    const idx = rsc.indexOf('"_source":', pos)
    if (idx === -1) break

    const objStart = rsc.indexOf("{", idx)
    if (objStart === -1) break

    let depth = 0
    let i = objStart
    while (i < rsc.length) {
      if (rsc[i] === "{") depth++
      else if (rsc[i] === "}") {
        depth--
        if (depth === 0) {
          try {
            results.push(JSON.parse(rsc.slice(objStart, i + 1)))
          } catch {}
          break
        }
      }
      i++
    }
    pos = objStart + 1
  }

  return results
}

// All _source fields come back as single-element arrays.
function first<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function parseCoords(raw: string[] | null): { lat: number; lng: number } | null {
  if (!raw?.length) return null
  try {
    const geo = JSON.parse(raw[0])
    const coords = geo?.features?.[0]?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return null
    return { lng: coords[0] as number, lat: coords[1] as number }
  } catch {
    return null
  }
}

function toWorksite(src: any): Worksite | null {
  const coords = parseCoords(src.field_worksite_geomarker)
  if (!coords) return null

  const rawUrl = first<string>(src.node_url)

  return {
    nid: first<number>(src.nid) ?? 0,
    title: first<string>(src.title) ?? "Sans titre",
    summary: first<string>(src.field_summary),
    status: first<string>(src.field_worksite_status),
    timing: first<string>(src.field_worksite_estimated_timing),
    municipalities: Array.isArray(src.field_worksite_municipalities)
      ? src.field_worksite_municipalities.flat()
      : [],
    manager: first<string>(src.field_worksite_manager),
    disruptions: first<string>(src.field_worksite_disruptions),
    url: rawUrl ? `https://be.brussels${rawUrl}` : null,
    lat: coords.lat,
    lng: coords.lng,
  }
}

export async function GET() {
  try {
    const res = await fetch(PAGE_URL, { headers: FETCH_HEADERS, cache: "no-store" })
    if (!res.ok) {
      console.error("[roadworks] fetch failed:", res.status)
      return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 })
    }

    const html = await res.text()
    const rsc = decodeRscChunk(html)
    if (!rsc) {
      console.error("[roadworks] RSC chunk not found")
      return NextResponse.json({ error: "data not found in page" }, { status: 500 })
    }

    const sources = extractSources(rsc)
    const worksites = sources.flatMap((s) => {
      const w = toWorksite(s)
      return w ? [w] : []
    })

    console.log(`[roadworks] parsed ${worksites.length} worksites`)
    return NextResponse.json(worksites, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    })
  } catch (e) {
    console.error("[roadworks]", e)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
