CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`initial_balance` text DEFAULT '0' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`ai_name` text,
	`country_code` text,
	`city` text,
	`primary_currency` text,
	`reference_currencies` text DEFAULT '[]' NOT NULL,
	`ai_mode` text DEFAULT 'manual' NOT NULL,
	`onboarding_step` text DEFAULT 'ai_name' NOT NULL,
	`updated_at` text NOT NULL
);
