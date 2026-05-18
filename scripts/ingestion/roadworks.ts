/**
 * Roadworks ingestion from be.brussels/fr/info-trafic.
 * Scrapes the Next.js RSC page, parses the embedded Elasticsearch payload,
 * and upserts all active worksites into the items table.
 *
 * Run: npm run ingest:roadworks
 *
 * Cadence: run daily or on-demand — worksites change slowly.
 * On each run it removes worksites that are no longer listed (completed/cancelled).
 */

import "dotenv/config"
import { db, items } from "@brux/db"
import { eq, notInArray, and } from "drizzle-orm"

const PAGE_URL = "https://be.brussels/fr/info-trafic"

const FETCH_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
  "cache-control": "max-age=0",
  cookie: "NEXT_LOCALE=fr",
  dnt: "1",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
}

// ── Parsing ────────────────────────────────────────────────────────────────

function decodeRscChunk(html: string): string | null {
  const markerIdx = html.indexOf("worksite_prod")
  if (markerIdx === -1) return null

  const pushStart = html.lastIndexOf("self.__next_f.push([1,", markerIdx)
  if (pushStart === -1) return null

  const quoteStart = html.indexOf('"', pushStart + "self.__next_f.push([1,".length) + 1
  const chars: string[] = []
  let i = quoteStart

  while (i < html.length) {
    if (html[i] === "\\") { chars.push(html[i], html[i + 1]); i += 2 }
    else if (html[i] === '"') break
    else { chars.push(html[i]); i++ }
  }

  try { return JSON.parse('"' + chars.join("") + '"') } catch { return null }
}

function extractSources(rsc: string): any[] {
  const results: any[] = []
  let pos = 0

  while (true) {
    const idx = rsc.indexOf('"_source":', pos)
    if (idx === -1) break

    const objStart = rsc.indexOf("{", idx)
    if (objStart === -1) break

    let depth = 0
    for (let i = objStart; i < rsc.length; i++) {
      if (rsc[i] === "{") depth++
      else if (rsc[i] === "}") {
        depth--
        if (depth === 0) {
          try { results.push(JSON.parse(rsc.slice(objStart, i + 1))) } catch {}
          break
        }
      }
    }
    pos = objStart + 1
  }

  return results
}

// All _source fields are single-element arrays
function first<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function parseCoords(raw: string[] | null): { lat: number; lng: number } | null {
  if (!raw?.length) return null
  try {
    const geo = JSON.parse(raw[0])
    const coords = geo?.features?.[0]?.geometry?.coordinates
    return Array.isArray(coords) && coords.length >= 2
      ? { lng: coords[0] as number, lat: coords[1] as number }
      : null
  } catch { return null }
}

// ── Commune detection ──────────────────────────────────────────────────────

const COMMUNE_MAP: Array<{ keywords: string[]; id: number }> = [
  { keywords: ["anderlecht"], id: 1 },
  { keywords: ["auderghem", "oudergem"], id: 2 },
  { keywords: ["berchem-sainte-agathe", "sint-agatha-berchem", "berchem"], id: 3 },
  { keywords: ["ville de bruxelles", "bruxelles-ville", "brussel", "brussels", "pentagone", "laeken", "neder-over-heembeek"], id: 4 },
  { keywords: ["etterbeek"], id: 5 },
  { keywords: ["evere"], id: 6 },
  { keywords: ["forest", "vorst"], id: 7 },
  { keywords: ["ganshoren"], id: 8 },
  { keywords: ["ixelles", "elsene"], id: 9 },
  { keywords: ["jette"], id: 10 },
  { keywords: ["koekelberg"], id: 11 },
  { keywords: ["molenbeek"], id: 12 },
  { keywords: ["saint-gilles", "sint-gillis"], id: 13 },
  { keywords: ["saint-josse", "sint-joost"], id: 14 },
  { keywords: ["schaerbeek", "schaarbeek"], id: 15 },
  { keywords: ["uccle", "ukkel"], id: 16 },
  { keywords: ["watermael", "watermaal"], id: 17 },
  { keywords: ["woluwe-saint-lambert", "sint-lambrechts-woluwe"], id: 18 },
  { keywords: ["woluwe-saint-pierre", "sint-pieters-woluwe"], id: 19 },
]

function detectCommune(municipalities: string[]): number | null {
  const text = municipalities.join(" ").toLowerCase()
  for (const { keywords, id } of COMMUNE_MAP) {
    if (keywords.some((kw) => text.includes(kw))) return id
  }
  return null
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching be.brussels roadworks page…")
  const res = await fetch(PAGE_URL, { headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} from be.brussels`)

  const html = await res.text()
  const rsc = decodeRscChunk(html)
  if (!rsc) throw new Error("Could not find RSC data chunk in page")

  const sources = extractSources(rsc)
  console.log(`Parsed ${sources.length} worksites from page`)

  const activeUrls: string[] = []
  let upserted = 0
  let skipped = 0

  for (const src of sources) {
    const coords = parseCoords(src.field_worksite_geomarker)
    if (!coords) { skipped++; continue }

    const rawUrl = first<string>(src.node_url)
    if (!rawUrl) { skipped++; continue }

    const sourceUrl = `https://be.brussels${rawUrl}`
    activeUrls.push(sourceUrl)

    const municipalities: string[] = Array.isArray(src.field_worksite_municipalities)
      ? src.field_worksite_municipalities.flat()
      : []

    const title = first<string>(src.title) ?? "Chantier sans titre"
    const summary = first<string>(src.field_summary)
    const status = first<string>(src.field_worksite_status)
    const timing = first<string>(src.field_worksite_estimated_timing)
    const manager = first<string>(src.field_worksite_manager)
    const communeId = detectCommune(municipalities)

    // Build a useful summary combining available metadata
    const summaryParts = [summary, status, timing, manager].filter(Boolean)
    const fullSummary = summaryParts.length ? summaryParts.join(" · ") : null

    await db
      .insert(items)
      .values({
        type: "roadwork",
        title,
        summary: fullSummary,
        sourceUrl,
        sourceName: "be.brussels",
        communeId,
        lat: coords.lat,
        lng: coords.lng,
        publishedAt: new Date(),
        raw: src,
      })
      .onConflictDoUpdate({
        target: items.sourceUrl,
        set: {
          title,
          summary: fullSummary,
          lat: coords.lat,
          lng: coords.lng,
          communeId,
          raw: src,
        },
      })

    upserted++
  }

  // Remove worksites that are no longer listed (completed / cancelled)
  let removed = 0
  if (activeUrls.length > 0) {
    const result = await db
      .delete(items)
      .where(
        and(
          eq(items.type, "roadwork"),
          notInArray(items.sourceUrl, activeUrls)
        )
      )
    removed = result.rowCount ?? 0
  }

  console.log(`Done. Upserted: ${upserted}  Skipped (no coords): ${skipped}  Removed (completed): ${removed}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
