CREATE TABLE "auth_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"message" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invocations" ADD COLUMN "payment_order" jsonb;--> statement-breakpoint
ALTER TABLE "invocations" ADD COLUMN "payment_proof" jsonb;--> statement-breakpoint
ALTER TABLE "invocations" ADD COLUMN "receipt" jsonb;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "receiving_wallet" text;--> statement-breakpoint
UPDATE "services"
SET "receiving_wallet" = "users"."wallet_address"
FROM "sellers"
JOIN "users" ON "users"."id" = "sellers"."user_id"
WHERE "services"."seller_id" = "sellers"."id";--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "services" WHERE "receiving_wallet" IS NULL) THEN
		RAISE EXCEPTION 'Cannot backfill services.receiving_wallet';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "receiving_wallet" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_user_idx" ON "sellers" USING btree ("user_id");
