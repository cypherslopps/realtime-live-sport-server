CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'finished');--> statement-breakpoint
CREATE TABLE "commentary" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer,
	"minute" integer,
	"sequence" integer,
	"period" varchar(50),
	"event_type" varchar(50),
	"actor" varchar(255),
	"team" varchar(255),
	"message" text,
	"metadata" jsonb,
	"tags" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport" varchar(255),
	"home_team" varchar(255),
	"away_team" varchar(255),
	"status" "match_status" DEFAULT 'scheduled',
	"start_time" timestamp,
	"end_time" timestamp,
	"home_score" integer DEFAULT 0,
	"away_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "commentary" ADD CONSTRAINT "commentary_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;