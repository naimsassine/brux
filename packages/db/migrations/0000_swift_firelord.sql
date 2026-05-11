CREATE TYPE "public"."item_type" AS ENUM('news', 'event', 'roadwork');--> statement-breakpoint
CREATE TABLE "communes" (
	"id" integer PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"name_nl" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "item_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"source_url" text,
	"source_name" text NOT NULL,
	"commune_id" integer,
	"lat" double precision,
	"lng" double precision,
	"published_at" timestamp with time zone NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_type_idx" ON "items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "items_commune_idx" ON "items" USING btree ("commune_id");--> statement-breakpoint
CREATE INDEX "items_published_idx" ON "items" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "items_source_url_idx" ON "items" USING btree ("source_url");