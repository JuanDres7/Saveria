CREATE TYPE "public"."account_type" AS ENUM('cash', 'wallet', 'bank');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('expense', 'income', 'transfer', 'adjustment');--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency" char(3) NOT NULL,
	"to_account_id" uuid,
	"to_amount" numeric(19, 4),
	"to_currency" char(3),
	"category_slug" varchar(32),
	"description" varchar(120),
	"occurred_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "transactions_fields_by_type_chk" CHECK ((
        ("transactions"."type" IN ('expense', 'income') AND "transactions"."amount" > 0
          AND "transactions"."category_slug" IS NOT NULL AND "transactions"."to_account_id" IS NULL
          AND "transactions"."to_amount" IS NULL AND "transactions"."to_currency" IS NULL)
        OR ("transactions"."type" = 'transfer' AND "transactions"."amount" > 0 AND "transactions"."category_slug" IS NULL
          AND "transactions"."to_account_id" IS NOT NULL AND "transactions"."to_account_id" <> "transactions"."account_id"
          AND "transactions"."to_amount" > 0 AND "transactions"."to_currency" IS NOT NULL)
        OR ("transactions"."type" = 'adjustment' AND "transactions"."amount" <> 0 AND "transactions"."category_slug" IS NULL
          AND "transactions"."to_account_id" IS NULL AND "transactions"."to_amount" IS NULL
          AND "transactions"."to_currency" IS NULL)
      ))
);
--> statement-breakpoint
DROP INDEX "accounts_one_default_per_user_idx";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "type" "account_type" DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_occurred_idx" ON "transactions" USING btree ("user_id","occurred_on" DESC NULLS LAST,"created_at" DESC NULLS LAST) WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id") WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "transactions_to_account_idx" ON "transactions" USING btree ("to_account_id") WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_active_name_idx" ON "accounts" USING btree ("user_id",lower("name")) WHERE "accounts"."archived_at" IS NULL AND "accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_one_default_per_user_idx" ON "accounts" USING btree ("user_id") WHERE "accounts"."is_default" AND "accounts"."archived_at" IS NULL AND "accounts"."deleted_at" IS NULL;