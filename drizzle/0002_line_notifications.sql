CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"line_user_id" text NOT NULL,
	"display_name" text,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"line_user_id" text NOT NULL,
	"student_count" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"teacher_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"every_days" integer DEFAULT 7 NOT NULL,
	"send_hour" integer DEFAULT 18 NOT NULL,
	"last_sent_on" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "line_link_code" text;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_student_line_user_unique" ON "guardians" USING btree ("student_id","line_user_id");--> statement-breakpoint
CREATE INDEX "guardians_line_user_id_idx" ON "guardians" USING btree ("line_user_id");--> statement-breakpoint
CREATE INDEX "notification_logs_teacher_created_idx" ON "notification_logs" USING btree ("teacher_id","created_at");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_line_link_code_unique" UNIQUE("line_link_code");