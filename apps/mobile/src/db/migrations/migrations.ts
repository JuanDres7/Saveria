// Generado por scripts/embed-migrations.mjs. No editar a mano: ejecuta `bun run db:generate`.
export const migrations = {
  journal: {
    entries: [
      {
        idx: 0,
        version: '6',
        when: 1792726113481,
        tag: '0000_thin_raza',
        breakpoints: true,
      },
    ],
  },
  migrations: {
    m0000:
      "CREATE TABLE `accounts` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`name` text NOT NULL,\n\t`currency` text NOT NULL,\n\t`initial_balance` text DEFAULT '0' NOT NULL,\n\t`is_default` integer DEFAULT false NOT NULL,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`deleted_at` text\n);\n--> statement-breakpoint\nCREATE TABLE `meta` (\n\t`key` text PRIMARY KEY NOT NULL,\n\t`value` text NOT NULL\n);\n--> statement-breakpoint\nCREATE TABLE `outbox` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`entity` text NOT NULL,\n\t`entity_id` text NOT NULL,\n\t`operation` text NOT NULL,\n\t`payload` text NOT NULL,\n\t`created_at` integer NOT NULL,\n\t`attempts` integer DEFAULT 0 NOT NULL,\n\t`last_error` text,\n\t`next_attempt_at` integer DEFAULT 0 NOT NULL\n);\n--> statement-breakpoint\nCREATE TABLE `profile` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`ai_name` text,\n\t`country_code` text,\n\t`city` text,\n\t`primary_currency` text,\n\t`reference_currencies` text DEFAULT '[]' NOT NULL,\n\t`ai_mode` text DEFAULT 'manual' NOT NULL,\n\t`onboarding_step` text DEFAULT 'ai_name' NOT NULL,\n\t`updated_at` text NOT NULL\n);\n",
  },
};
