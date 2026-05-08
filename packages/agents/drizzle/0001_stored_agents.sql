CREATE TABLE "stored_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"description" text,
	"current_version_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stored_agent_version" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" integer NOT NULL,
	"instructions" text NOT NULL,
	"tools" text NOT NULL,
	"model" text NOT NULL,
	"notes" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "stored_agent_version_agent_id_version_unique" UNIQUE("agent_id","version")
);
--> statement-breakpoint
ALTER TABLE "stored_agent" ADD CONSTRAINT "stored_agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_agent_version" ADD CONSTRAINT "stored_agent_version_agent_id_stored_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."stored_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stored_agent_user_id_idx" ON "stored_agent" ("user_id");--> statement-breakpoint
CREATE INDEX "stored_agent_version_agent_id_idx" ON "stored_agent_version" ("agent_id");
