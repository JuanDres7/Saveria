CREATE TYPE "public"."ai_mode" AS ENUM('manual', 'auto');--> statement-breakpoint
CREATE TYPE "public"."onboarding_step" AS ENUM('ai_name', 'country', 'city', 'currency', 'ai_mode', 'done');--> statement-breakpoint
CREATE TYPE "public"."one_time_token_kind" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."session_revoke_reason" AS ENUM('logout', 'password_changed', 'password_reset', 'reuse_detected', 'replaced', 'account_deleted');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(40) NOT NULL,
	"currency" char(3) NOT NULL,
	"initial_balance" numeric(19, 4) DEFAULT '0' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "one_time_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "one_time_token_kind" NOT NULL,
	"token_hash" char(64) NOT NULL,
	"target_email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "one_time_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"device_id" uuid NOT NULL,
	"device_name" varchar(80),
	"refresh_token_hash" char(64) NOT NULL,
	"previous_refresh_token_hash" char(64),
	"rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" "session_revoke_reason"
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ai_name" varchar(30),
	"country_code" char(2),
	"city" varchar(80),
	"primary_currency" char(3),
	"reference_currencies" char(3)[] DEFAULT '{}' NOT NULL,
	"ai_mode" "ai_mode" DEFAULT 'manual' NOT NULL,
	"onboarding_step" "onboarding_step" DEFAULT 'ai_name' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"policy_version" text NOT NULL,
	"policy_accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_one_default_per_user_idx" ON "accounts" USING btree ("user_id") WHERE "accounts"."is_default" AND "accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "one_time_tokens_user_kind_idx" ON "one_time_tokens" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");