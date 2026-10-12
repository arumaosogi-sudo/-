CREATE TABLE "line_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text NOT NULL,
	"channel_secret_enc" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"pending_secret_enc" text,
	"basic_id" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_channels_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
-- Old links belonged to the single env-configured OA and cannot be mapped to a channel.
DELETE FROM "guardians";--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "line_channel_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "line_channel_id" uuid;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_line_channel_id_line_channels_id_fk" FOREIGN KEY ("line_channel_id") REFERENCES "public"."line_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_line_channel_id_line_channels_id_fk" FOREIGN KEY ("line_channel_id") REFERENCES "public"."line_channels"("id") ON DELETE set null ON UPDATE no action;