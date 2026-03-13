ALTER TABLE "commentary" ALTER COLUMN "match_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "minute" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "sequence" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "period" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "event_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "actor" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "team" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "message" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "sport" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "home_team" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "away_team" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "start_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "home_score" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "away_score" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "created_at" SET NOT NULL;