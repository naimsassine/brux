/**
 * Multi-source RSS news ingestion.
 * Each source declares its language; non-English content is translated via GPT-mini.
 */

import "dotenv/config"
import { db, items } from "@brux/db"
import { translateToEnglish } from "./translate"
import { extractAndGeocodeLocation } from "./geocode"

interface RssSource {
  name: string
  url: string
  lang: "en" | "nl" | "fr"
}

const SOURCES: RssSource[] = [
  {
    name: "Bruzz",
    url: "https://www.bruzz.be/rss.xml",
    lang: "nl",
  },
]

// Commune keyword matching — Dutch + French names since both sources use them
const COMMUNE_KEYWORDS: Array<{ keywords: string[]; id: number }> = [
  { keywords: ["anderlecht"], id: 1 },
  { keywords: ["auderghem", "oudergem"], id: 2 },
  { keywords: ["berchem-sainte-agathe", "sint-agatha-berchem", "berchem"], id: 3 },
  { keywords: ["bruxelles", "brussel", "brussels", "grand place", "manneken", "pentagone", "vijfhoek", "schaarbeek"], id: 4 },
  { keywords: ["etterbeek"], id: 5 },
  { keywords: ["evere"], id: 6 },
  { keywords: ["forest", "vorst"], id: 7 },
  { keywords: ["ganshoren"], id: 8 },
  { keywords: ["ixelles", "elsene"], id: 9 },
  { keywords: ["jette"], id: 10 },
  { keywords: ["koekelberg"], id: 11 },
  { keywords: ["molenbeek"], id: 12 },
  { keywords: ["saint-gilles", "sint-gillis", "st-gilles"], id: 13 },
  { keywords: ["saint-josse", "sint-joost"], id: 14 },
  { keywords: ["schaerbeek", "schaarbeek"], id: 15 },
  { keywords: ["uccle", "ukkel"], id: 16 },
  { keywords: ["watermael", "watermaal"], id: 17 },
  { keywords: ["woluwe-saint-lambert", "sint-lambrechts-woluwe"], id: 18 },
  { keywords: ["woluwe-saint-pierre", "sint-pieters-woluwe"], id: 19 },
]

function detectCommune(text: string): number | null {
  const lower = text.toLowerCase()
  for (const entry of COMMUNE_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.id
  }
  return null
}

interface RssItem {
  guid: string
  title: string
  link: string
  description: string
  pubDate: string
}

function parseRss(xml: string): RssItem[] {
  const result: RssItem[] = []
  const itemBlocks = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemBlocks) {
    const block = match[1]

    const guid =
      block.match(/<guid[^>]*><!\[CDATA\[(.*?)\]\]><\/guid>/)?.[1] ??
      block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ??
      block.match(/<link>(.*?)<\/link>/)?.[1] ??
      ""

    const title =
      block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      block.match(/<title>(.*?)<\/title>/)?.[1] ??
      ""

    const link =
      block.match(/<link>(.*?)<\/link>/)?.[1] ??
      guid

    const description =
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ??
      block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ??
      ""

    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ""

    if (title && guid) result.push({ guid, title, link, description, pubDate })
  }

  return result
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim()
}

async function ingestSource(source: RssSource): Promise<number> {
  console.log(`\nFetching ${source.name}...`)

  const res = await fetch(source.url, {
    headers: { "User-Agent": "Brux-Dashboard/1.0 (civic data aggregator)" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${source.url}`)

  const xml = await res.text()
  const entries = parseRss(xml)
  console.log(`  Found ${entries.length} articles`)

  let ingested = 0
  for (const entry of entries) {
    const rawTitle = entry.title
    const rawSummary = stripHtml(entry.description).slice(0, 600)

    const title =
      source.lang === "en"
        ? rawTitle
        : await translateToEnglish(rawTitle, source.lang)

    const summary =
      rawSummary.length < 10
        ? null
        : source.lang === "en"
        ? rawSummary
        : await translateToEnglish(rawSummary, source.lang)

    const searchText = `${rawTitle} ${rawSummary}`
    const communeId = detectCommune(searchText)
    const coords = await extractAndGeocodeLocation(title, summary)

    await db
      .insert(items)
      .values({
        type: "news",
        title,
        summary,
        sourceUrl: entry.link || entry.guid,
        sourceName: source.name,
        communeId,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        publishedAt: entry.pubDate ? new Date(entry.pubDate) : new Date(),
        raw: entry as any,
      })
      .onConflictDoNothing()

    ingested++
  }

  console.log(`  Ingested ${ingested} articles from ${source.name}`)
  return ingested
}

async function main() {
  let total = 0
  for (const source of SOURCES) {
    total += await ingestSource(source)
  }
  console.log(`\nDone. Total: ${total} articles ingested.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
