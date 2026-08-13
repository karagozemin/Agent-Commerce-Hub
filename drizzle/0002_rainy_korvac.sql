ALTER TABLE "services" ADD COLUMN "test_input" jsonb;--> statement-breakpoint
UPDATE "services" SET "test_input" = '{}'::jsonb WHERE "test_input" IS NULL;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "test_input" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "endpoint_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "endpoint_latency_ms" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "endpoint_last_error" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "published_at" timestamp with time zone;
