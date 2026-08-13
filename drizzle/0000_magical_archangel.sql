CREATE TYPE "public"."invocation_status" AS ENUM('CREATED', 'PAYMENT_REQUIRED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'EXECUTING', 'SUCCEEDED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'EXECUTION_FAILED', 'REFUND_REQUIRED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "agent_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"network" text NOT NULL,
	"registry_address" text NOT NULL,
	"agent_id" text NOT NULL,
	"agent_uri" text NOT NULL,
	"owner_wallet" text NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "internal_wallets" (
	"wallet_address" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invocations" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"service_id" text NOT NULL,
	"buyer_wallet" text NOT NULL,
	"order_id" text,
	"tx_hash" text,
	"amount" numeric NOT NULL,
	"amount_wei" text NOT NULL,
	"asset" text NOT NULL,
	"status" "invocation_status" DEFAULT 'CREATED' NOT NULL,
	"input" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"output" jsonb,
	"output_hash" text,
	"payment_confirmed_at" timestamp with time zone,
	"execution_started_at" timestamp with time zone,
	"execution_completed_at" timestamp with time zone,
	"latency_ms" integer,
	"is_internal" boolean DEFAULT false NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"endpoint" text NOT NULL,
	"method" text DEFAULT 'POST' NOT NULL,
	"input_schema" jsonb NOT NULL,
	"output_schema" jsonb NOT NULL,
	"price" numeric NOT NULL,
	"amount_wei" text NOT NULL,
	"asset" text NOT NULL,
	"network" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "agent_identities" ADD CONSTRAINT "agent_identities_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invocations" ADD CONSTRAINT "invocations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invocations_idempotency_idx" ON "invocations" USING btree ("idempotency_key","buyer_wallet");