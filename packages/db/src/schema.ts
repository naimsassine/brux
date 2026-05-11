import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const itemTypeEnum = pgEnum("item_type", [
  "news",
  "event",
  "roadwork",
])

export const communes = pgTable("communes", {
  id: integer("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameFr: text("name_fr").notNull(),
  nameNl: text("name_nl").notNull(),
  // boundary stored as PostGIS geometry — managed via raw SQL migration
})

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: itemTypeEnum("type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    sourceUrl: text("source_url"),
    sourceName: text("source_name").notNull(),
    communeId: integer("commune_id").references(() => communes.id),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    typeIdx: index("items_type_idx").on(t.type),
    communeIdx: index("items_commune_idx").on(t.communeId),
    publishedIdx: index("items_published_idx").on(t.publishedAt),
    sourceUrlIdx: uniqueIndex("items_source_url_idx").on(t.sourceUrl),
  })
)

export type Commune = typeof communes.$inferSelect
export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert
