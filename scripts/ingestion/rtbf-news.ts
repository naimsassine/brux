/**
 * Scrapes Brussels headlines from rtbf.be/archive/bruxelles.
 * Dates are relative on the page, so publishedAt defaults to now.
 * Titles and summaries are translated to English via GPT-mini.
 */

import "dotenv/config"
import { db, items } from "@brux/db"
import { translateToEnglish } from "./translate"
import { extractAndGeocodeLocation } from "./geocode"
import { fetchWithRetry } from "./fetch-retry"

const BASE_URL = "https://www.rtbf.be"
const ARCHIVE_URL = `${BASE_URL}/archive/bruxelles`

const COMMUNE_KEYWORDS: Array<{ keywords: string[]; id: number }> = [
  { keywords: ["anderlecht"], id: 1 },
  { keywords: ["auderghem", "oudergem"], id: 2 },
  { keywords: ["berchem-sainte-agathe", "sint-agatha-berchem", "berchem"], id: 3 },
  { keywords: ["bruxelles", "brussel", "brussels", "grand place", "pentagone"], id: 4 },
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

interface ScrapedArticle {
  title: string
  url: string
  summary: string | null
}

function scrapeArchivePage(html: string): ScrapedArticle[] {
  const seen = new Set<string>()
  const results: ScrapedArticle[] = []

  // Each card has an <h3 class="card-title ..."> with a stretched-link <a href="/article/...">
  const cardPattern =
    /<h3[^>]*class="card-title[^"]*"[^>]*>\s*<a[^>]+href="(\/article\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let match: RegExpExecArray | null

  while ((match = cardPattern.exec(html)) !== null) {
    const path = match[1]
    if (seen.has(path)) continue
    seen.add(path)

    const title = match[2].replace(/<[^>]+>/g, "").trim()
    if (!title) continue

    // Optional summary: <p class="hidden text-14 ..."> immediately after the card header
    const afterCard = html.slice(match.index + match[0].length, match.index + match[0].length + 600)
    const summaryMatch = afterCard.match(/<p[^>]*class="[^"]*text-14[^"]*"[^>]*>([\s\S]*?)<\/p>/)
    const summary = summaryMatch
      ? summaryMatch[1].replace(/<[^>]+>/g, "").trim() || null
      : null

    results.push({ title, url: `${BASE_URL}${path}`, summary })
  }

  return results
}

async function main() {
  console.log("Fetching rtbf.be/archive/bruxelles...")

  const res = await fetchWithRetry(ARCHIVE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-BE,fr;q=0.9",
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from rtbf.be`)

  const html = await res.text()
  const articles = scrapeArchivePage(html)
  console.log(`  Found ${articles.length} articles`)

  let ingested = 0
  for (const article of articles) {
    const title = await translateToEnglish(article.title, "fr")
    const summary = article.summary ? await translateToEnglish(article.summary, "fr") : null

    const searchText = `${article.title} ${article.summary ?? ""}`
    const communeId = detectCommune(searchText)
    const coords = await extractAndGeocodeLocation(title, summary)

    await db
      .insert(items)
      .values({
        type: "news",
        title,
        summary,
        sourceUrl: article.url,
        sourceName: "RTBF",
        communeId,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        publishedAt: new Date(),
        raw: { rawTitle: article.title, rawSummary: article.summary } as any,
      })
      .onConflictDoNothing()

    ingested++
  }

  console.log(`  Ingested ${ingested} articles from RTBF`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
