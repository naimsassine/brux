/**
 * Scrapes top headlines from bruxellestoday.be (French-language Brussels news).
 * The homepage has no dates in article listings, so publishedAt defaults to now.
 * Titles and summaries are translated to English via GPT-mini.
 */

import "dotenv/config"
import { db, items } from "@brux/db"
import { translateToEnglish } from "./translate"
import { extractAndGeocodeLocation } from "./geocode"
import { fetchWithRetry } from "./fetch-retry"

const BASE_URL = "https://www.bruxellestoday.be"

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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, "")
    .replace(/&#\d+;/g, "")
    .trim()
}

interface ScrapedArticle {
  title: string
  url: string
}

function scrapeHomepage(html: string): ScrapedArticle[] {
  const seen = new Set<string>()
  const results: ScrapedArticle[] = []

  // Match article blocks
  const articlePattern = /<article[^>]*class="c-story[^"]*"[^>]*>([\s\S]*?)<\/article>/g
  let match: RegExpExecArray | null

  while ((match = articlePattern.exec(html)) !== null) {
    const block = match[1]

    // Extract the first internal link
    const linkMatch = block.match(/href="(\/[^"]+\.html)"/)
    if (!linkMatch) continue
    const path = linkMatch[1]
    if (seen.has(path)) continue
    seen.add(path)

    // Extract heading text
    const headingMatch = block.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/)
    if (!headingMatch) continue
    const rawTitle = headingMatch[1].replace(/<[^>]+>/g, "").trim()
    const title = decodeHtmlEntities(rawTitle)
    if (!title) continue

    results.push({ title, url: `${BASE_URL}${path}` })
  }

  return results
}

async function main() {
  console.log("Fetching bruxellestoday.be homepage...")

  const res = await fetchWithRetry(BASE_URL, {
    headers: {
      "User-Agent": "Brux-Dashboard/1.0 (civic data aggregator)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-BE,fr;q=0.9",
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from bruxellestoday.be`)

  const html = await res.text()
  const articles = scrapeHomepage(html)
  console.log(`  Found ${articles.length} articles`)

  let ingested = 0
  for (const article of articles) {
    const title = await translateToEnglish(article.title, "fr")
    const communeId = detectCommune(article.title)
    const coords = await extractAndGeocodeLocation(title, null)

    await db
      .insert(items)
      .values({
        type: "news",
        title,
        summary: null,
        sourceUrl: article.url,
        sourceName: "BruxellesToday",
        communeId,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        publishedAt: new Date(),
        raw: { rawTitle: article.title } as any,
      })
      .onConflictDoNothing()

    ingested++
  }

  console.log(`  Ingested ${ingested} articles from BruxellesToday`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
