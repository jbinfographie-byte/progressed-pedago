CREATE TABLE `document_indexes` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`algorithm` text DEFAULT 'page-summary-v1' NOT NULL,
	`chunk_count` integer DEFAULT 0 NOT NULL,
	`index_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_document_indexes_file` ON `document_indexes` (`file_id`);--> statement-breakpoint
CREATE INDEX `idx_document_indexes_owner` ON `document_indexes` (`trainer_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `scenario_choices` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`position` integer NOT NULL,
	`score` integer NOT NULL,
	`content_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenario_scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_scenario_choices_score" CHECK("scenario_choices"."score" BETWEEN 0 AND 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_scenario_choices_scene_position` ON `scenario_choices` (`scene_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_scenario_choices_owner_scene` ON `scenario_choices` (`trainer_id`,`scene_id`);--> statement-breakpoint
CREATE TABLE `scenario_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`project_id` text,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`content_json` text NOT NULL,
	`sources_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `scenario_projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_scenario_scenes_activity_position` ON `scenario_scenes` (`activity_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_scenario_scenes_owner_activity` ON `scenario_scenes` (`trainer_id`,`activity_id`);--> statement-breakpoint
ALTER TABLE `document_pages` ADD `excluded_information_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
PRAGMA optimize;
