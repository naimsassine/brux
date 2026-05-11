/**
 * Seeds the 19 Brussels communes into the DB.
 * Run once after migrations.
 */

import "dotenv/config"
import { db, communes } from "@brux/db"

const COMMUNES = [
  { id: 1,  nameEn: "Anderlecht",            nameFr: "Anderlecht",               nameNl: "Anderlecht" },
  { id: 2,  nameEn: "Auderghem",             nameFr: "Auderghem",                nameNl: "Oudergem" },
  { id: 3,  nameEn: "Berchem-Sainte-Agathe", nameFr: "Berchem-Sainte-Agathe",   nameNl: "Sint-Agatha-Berchem" },
  { id: 4,  nameEn: "Brussels",              nameFr: "Bruxelles",                nameNl: "Brussel" },
  { id: 5,  nameEn: "Etterbeek",             nameFr: "Etterbeek",                nameNl: "Etterbeek" },
  { id: 6,  nameEn: "Evere",                 nameFr: "Evere",                    nameNl: "Evere" },
  { id: 7,  nameEn: "Forest",                nameFr: "Forest",                   nameNl: "Vorst" },
  { id: 8,  nameEn: "Ganshoren",             nameFr: "Ganshoren",                nameNl: "Ganshoren" },
  { id: 9,  nameEn: "Ixelles",               nameFr: "Ixelles",                  nameNl: "Elsene" },
  { id: 10, nameEn: "Jette",                 nameFr: "Jette",                    nameNl: "Jette" },
  { id: 11, nameEn: "Koekelberg",            nameFr: "Koekelberg",               nameNl: "Koekelberg" },
  { id: 12, nameEn: "Molenbeek",             nameFr: "Molenbeek-Saint-Jean",     nameNl: "Sint-Jans-Molenbeek" },
  { id: 13, nameEn: "Saint-Gilles",          nameFr: "Saint-Gilles",             nameNl: "Sint-Gillis" },
  { id: 14, nameEn: "Saint-Josse",           nameFr: "Saint-Josse-ten-Noode",    nameNl: "Sint-Joost-ten-Node" },
  { id: 15, nameEn: "Schaerbeek",            nameFr: "Schaerbeek",               nameNl: "Schaarbeek" },
  { id: 16, nameEn: "Uccle",                 nameFr: "Uccle",                    nameNl: "Ukkel" },
  { id: 17, nameEn: "Watermael-Boitsfort",   nameFr: "Watermael-Boitsfort",      nameNl: "Watermaal-Bosvoorde" },
  { id: 18, nameEn: "Woluwe-Saint-Lambert",  nameFr: "Woluwe-Saint-Lambert",     nameNl: "Sint-Lambrechts-Woluwe" },
  { id: 19, nameEn: "Woluwe-Saint-Pierre",   nameFr: "Woluwe-Saint-Pierre",      nameNl: "Sint-Pieters-Woluwe" },
]

async function seed() {
  console.log("Seeding communes...")
  await db.insert(communes).values(COMMUNES).onConflictDoNothing()
  console.log("Done.")
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
