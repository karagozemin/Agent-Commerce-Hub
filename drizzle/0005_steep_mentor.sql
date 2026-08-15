ALTER TABLE "invocations" ADD COLUMN "payment_session_id" text;--> statement-breakpoint
ALTER TABLE "invocations" ADD CONSTRAINT "invocations_payment_session_id_unique" UNIQUE("payment_session_id");