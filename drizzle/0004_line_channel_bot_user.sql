ALTER TABLE "line_channels" DROP CONSTRAINT "line_channels_channel_id_unique";--> statement-breakpoint
ALTER TABLE "line_channels" ADD COLUMN "bot_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "line_channels" ADD CONSTRAINT "line_channels_bot_user_id_unique" UNIQUE("bot_user_id");