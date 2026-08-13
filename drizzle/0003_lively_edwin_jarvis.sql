CREATE TABLE "merchant_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"api_url" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"encrypted_api_secret" text NOT NULL,
	"receiving_wallet" text NOT NULL,
	"network" text NOT NULL,
	"receive_type" text,
	"supported_tokens" jsonb,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_configs_seller_id_unique" UNIQUE("seller_id")
);
--> statement-breakpoint
ALTER TABLE "merchant_configs" ADD CONSTRAINT "merchant_configs_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;