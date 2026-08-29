CREATE TABLE `document_activity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`file_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`pages_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_document_activity_link` ON `document_activity_links` (`file_id`,`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_document_activity_links_owner_activity` ON `document_activity_links` (`trainer_id`,`activity_id`);--> statement-breakpoint
CREATE TABLE `document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`page_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`text_content` text NOT NULL,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `document_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_document_chunks_page_position` ON `document_chunks` (`page_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_document_chunks_owner_file` ON `document_chunks` (`trainer_id`,`file_id`,`page_id`);--> statement-breakpoint
CREATE TABLE `document_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`notions_json` text DEFAULT '[]' NOT NULL,
	`procedures_json` text DEFAULT '[]' NOT NULL,
	`risks_json` text DEFAULT '[]' NOT NULL,
	`rules_json` text DEFAULT '[]' NOT NULL,
	`examples_json` text DEFAULT '[]' NOT NULL,
	`audiences_json` text DEFAULT '[]' NOT NULL,
	`objectives_json` text DEFAULT '[]' NOT NULL,
	`level` text DEFAULT 'debutant' NOT NULL,
	`reading_quality` text DEFAULT 'good' NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	`selected` integer DEFAULT true NOT NULL,
	`trainer_notes` text DEFAULT '' NOT NULL,
	`validated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_document_pages_page_positive" CHECK("document_pages"."page_number" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_document_pages_file_page` ON `document_pages` (`file_id`,`page_number`);--> statement-breakpoint
CREATE INDEX `idx_document_pages_owner_file` ON `document_pages` (`trainer_id`,`file_id`,`page_number`);--> statement-breakpoint
CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`file_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_generation_jobs_attempt_positive" CHECK("generation_jobs"."attempt" > 0),
	CONSTRAINT "ck_generation_jobs_progress_range" CHECK("generation_jobs"."progress" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE INDEX `idx_generation_jobs_owner_status` ON `generation_jobs` (`trainer_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `knowledge_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_folders_owner_updated` ON `knowledge_folders` (`trainer_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `scenario_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`activity_id` text,
	`status` text DEFAULT 'preparing' NOT NULL,
	`file_ids_json` text DEFAULT '[]' NOT NULL,
	`brief_json` text DEFAULT '{}' NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_scenario_projects_owner_status` ON `scenario_projects` (`trainer_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `source_citations` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`file_id` text,
	`scene_id` text,
	`choice_id` text,
	`page_number` integer,
	`passage` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_source_citations_owner_activity` ON `source_citations` (`trainer_id`,`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_source_citations_file_page` ON `source_citations` (`file_id`,`page_number`);--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `knowledge_folder_id` text REFERENCES knowledge_folders(id);--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `detected_theme` text;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `keywords_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `content_created_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `analyzed_at` integer;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `uploaded_files` SET `updated_at` = `created_at` WHERE `updated_at` = 0;--> statement-breakpoint
PRAGMA optimize;
