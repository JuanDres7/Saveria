CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`account_id` text NOT NULL,
	`amount` text NOT NULL,
	`amount_e4` integer NOT NULL,
	`currency` text NOT NULL,
	`to_account_id` text,
	`to_amount` text,
	`to_amount_e4` integer,
	`to_currency` text,
	`category_slug` text,
	`description` text,
	`occurred_on` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`sync_error` text
);
--> statement-breakpoint
CREATE INDEX `transactions_occurred_idx` ON `transactions` (`occurred_on`,`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_to_account_idx` ON `transactions` (`to_account_id`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `type` text DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `initial_balance_e4` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `sync_state` text DEFAULT 'synced' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `sync_error` text;