CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`event` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `trainers` ADD `role` text DEFAULT 'trainer' NOT NULL;--> statement-breakpoint
ALTER TABLE `trainers` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `trainers` ADD `failed_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trainers` ADD `locked_until` text;--> statement-breakpoint
ALTER TABLE `trainers` ADD `last_login_at` text;--> statement-breakpoint
ALTER TABLE `trainers` ADD `password_version` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `trainers` ADD `must_change_password` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `trainers` SET `role` = 'admin' WHERE `id` = (SELECT MIN(`id`) FROM `trainers`);
--> statement-breakpoint
UPDATE `trainers` SET `password_version` = 1, `must_change_password` = true;
