/**
 * Events ingestion from visit.brussels agenda API.
 * Fetches upcoming events with venue coordinates.
 * EN titles are provided directly; descriptions are translated if missing in EN.
 */

import "dotenv/config"
import { db, items } from "@brux/db"
import { translateToEnglish } from "./translate"

const BASE_URL =
  "https://www.visit.brussels/content/visitbrussels/en/visitors/agenda/all-events-wizard/jcr:content/root/container/agendafinder.feed.json"

const PAGE_SIZE = 50
const MAX_PAGES = 10 // ~500 upcoming events max per run

interface VbPlace {
  location: { lat: number; lon: number } | null
  translations: {
    en?: { name?: string; address_city?: string }
    fr?: { name?: string; address_city?: string }
    nl?: { name?: string; address_city?: string }
  }
}

interface VbTranslation {
  name?: string
  shortdescr?: string | null
  longdescr?: string | null
  agenda_url?: string
}

interface VbEvent {
  id: string
  date_next: string
  date_start: string
  translations: {
    en?: VbTranslation
    fr?: VbTranslation
    nl?: VbTranslation
  }
  categories: {
    main?: { translations?: { en?: string } }
  }
  place: VbPlace
}

interface VbResponse {
  results: number
  totalPages: number
  data: VbEvent[]
}

async function fetchPage(page: number): Promise<VbResponse> {
  const url = `${BASE_URL}?lang=en&page=${page}&size=${PAGE_SIZE}`
  const res = await fetch(url, {
    headers: { "User-Agent": "Brux-Dashboard/1.0 (civic data aggregator)" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from visit.brussels API`)
  return res.json()
}

function pickDescription(event: VbEvent): { text: string | null; lang: "en" | "fr" | "nl" } {
  const en = event.translations.en
  if (en?.shortdescr) return { text: en.shortdescr.slice(0, 600), lang: "en" }
  if (en?.longdescr) return { text: en.longdescr.slice(0, 600), lang: "en" }

  const fr = event.translations.fr
  if (fr?.shortdescr) return { text: fr.shortdescr.slice(0, 600), lang: "fr" }
  if (fr?.longdescr) return { text: fr.longdescr.slice(0, 600), lang: "fr" }

  const nl = event.translations.nl
  if (nl?.shortdescr) return { text: nl.shortdescr.slice(0, 600), lang: "nl" }
  if (nl?.longdescr) return { text: nl.longdescr.slice(0, 600), lang: "nl" }

  return { text: null, lang: "en" }
}

// Commune keyword matching on venue name + city
const COMMUNE_KEYWORDS: Array<{ keywords: string[]; id: number }> = [
  { keywords: ["anderlecht"], id: 1 },
  { keywords: ["auderghem", "oudergem"], id: 2 },
  { keywords: ["berchem-sainte-agathe", "sint-agatha-berchem", "berchem"], id: 3 },
  { keywords: ["bruxelles", "brussel", "brussels", "ixelles", "molenbeek", "schaerbeek"], id: 4 },
  { keywords: ["etterbeek"], id: 5 },
  { keywords: ["evere"], id: 6 },
  { keywords: ["forest", "vorst"], id: 7 },
  { keywords: ["ganshoren"], id: 8 },
  { keywords: ["elsene"], id: 9 },
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

async function main() {
  let totalIngested = 0
  let page = 1

  console.log("Fetching events from visit.brussels...")

  while (page <= MAX_PAGES) {
    const data = await fetchPage(page)

    if (page === 1) {
      console.log(`  Total available: ${data.results} events across ${data.totalPages} pages`)
    }

    if (data.data.length === 0) break

    for (const event of data.data) {
      const en = event.translations.en
      const title = en?.name ?? event.translations.fr?.name ?? event.translations.nl?.name
      if (!title) continue

      const sourceUrl = en?.agenda_url
      if (!sourceUrl) continue

      const { text: rawDesc, lang: descLang } = pickDescription(event)

      const summary =
        rawDesc === null
          ? null
          : descLang === "en"
          ? rawDesc
          : await translateToEnglish(rawDesc, descLang)

      const lat = event.place?.location?.lat ?? null
      const lng = event.place?.location?.lon ?? null

      const venueText = [
        event.place?.translations?.en?.name,
        event.place?.translations?.en?.address_city,
        event.place?.translations?.fr?.address_city,
      ]
        .filter(Boolean)
        .join(" ")

      const communeId = detectCommune(venueText)

      const publishedAt = event.date_next
        ? new Date(event.date_next)
        : event.date_start
        ? new Date(event.date_start)
        : new Date()

      await db
        .insert(items)
        .values({
          type: "event",
          title,
          summary,
          sourceUrl,
          sourceName: "visit.brussels",
          communeId,
          lat,
          lng,
          publishedAt,
          raw: event as any,
        })
        .onConflictDoNothing()

      totalIngested++
    }

    console.log(`  Page ${page}: processed ${data.data.length} events (total so far: ${totalIngested})`)
    page++

    if (page >= data.totalPages) break

  }

  console.log(`\nDone. Ingested ${totalIngested} events.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
