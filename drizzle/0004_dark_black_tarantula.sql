ALTER TABLE "agent_identities" ADD COLUMN "service_id" text;--> statement-breakpoint
UPDATE "agent_identities" AS identity
SET "service_id" = candidate."id"
FROM (
	SELECT MIN("id") AS "id", "seller_id"
	FROM "services"
	GROUP BY "seller_id"
	HAVING COUNT(*) = 1
) AS candidate
WHERE identity."seller_id" = candidate."seller_id";--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "agent_identities" WHERE "service_id" IS NULL) THEN
		RAISE EXCEPTION 'Cannot safely map legacy agent identity to a service; manual service_id mapping is required';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "agent_identities" ADD CONSTRAINT "agent_identities_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_identities" ADD CONSTRAINT "agent_identities_service_id_unique" UNIQUE("service_id");--> statement-breakpoint
ALTER TABLE "agent_identities" ALTER COLUMN "service_id" SET NOT NULL;
