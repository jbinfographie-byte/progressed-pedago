CREATE TABLE `help_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`feature` text DEFAULT 'general' NOT NULL,
	`plans_json` text DEFAULT '[]' NOT NULL,
	`media_url` text DEFAULT '' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_help_articles_slug` ON `help_articles` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_help_articles_published_feature` ON `help_articles` (`published`,`feature`,`updated_at`);--> statement-breakpoint
CREATE TABLE `public_submission_events` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_public_submission_fingerprint_date` ON `public_submission_events` (`fingerprint`,`created_at`);--> statement-breakpoint
CREATE TABLE `sales_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`organization` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`trainer_count` integer DEFAULT 0 NOT NULL,
	`learner_count` integer DEFAULT 0 NOT NULL,
	`primary_need` text NOT NULL,
	`plan_interest` text DEFAULT 'undecided' NOT NULL,
	`wants_demo` integer DEFAULT false NOT NULL,
	`wants_quote` integer DEFAULT false NOT NULL,
	`wants_callback` integer DEFAULT false NOT NULL,
	`preferred_time` text DEFAULT '' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`consented_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sales_leads_reference` ON `sales_leads` (`reference`);--> statement-breakpoint
CREATE INDEX `idx_sales_leads_status_date` ON `sales_leads` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`author_id` text,
	`author_role` text NOT NULL,
	`message` text NOT NULL,
	`internal` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_support_messages_ticket_date` ON `support_messages` (`ticket_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`requester_id` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`urgency` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`page_url` text DEFAULT '' NOT NULL,
	`browser_info` text DEFAULT '' NOT NULL,
	`plan_name` text DEFAULT '' NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`assigned_to` text,
	`consented_at` integer NOT NULL,
	`resolved_at` integer,
	`closed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_support_tickets_reference` ON `support_tickets` (`reference`);--> statement-breakpoint
CREATE INDEX `idx_support_tickets_requester_date` ON `support_tickets` (`requester_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_support_tickets_status_priority` ON `support_tickets` (`status`,`priority`,`updated_at`);