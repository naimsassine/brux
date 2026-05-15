/**
 * One-shot backfill: geo-locate existing news items that have no lat/lng.
 * Run once with: npm run backfill:news:geo
 */

import "dotenv/config"
import { db, items } from "@brux/db"
import { eq, isNull, and } from "drizzle-orm"
import { extractAndGeocodeLocation } from "./geocode"

async function main() {
  const rows = await db
    .select({ id: items.id, title: items.title, summary: items.summary })
    .from(items)
    .where(and(eq(items.type, "news"), isNull(items.lat)))

  console.log(`Found ${rows.length} news items without coordinates.`)

  let located = 0
  for (const row of rows) {
    const coords = await extractAndGeocodeLocation(row.title, row.summary)
    if (!coords) continue

    await db.update(items).set({ lat: coords.lat, lng: coords.lng }).where(eq(items.id, row.id))
    located++
    console.log(`  [${located}] ${row.title.slice(0, 60)} → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
  }

  console.log(`\nDone. Located ${located} / ${rows.length} articles.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
