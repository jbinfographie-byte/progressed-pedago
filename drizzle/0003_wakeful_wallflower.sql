CREATE TABLE `course_folder_items` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `course_folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_course_folder_position" CHECK("course_folder_items"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_course_folder_activity` ON `course_folder_items` (`folder_id`,`activity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_course_folder_position` ON `course_folder_items` (`folder_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_course_folder_items_activity` ON `course_folder_items` (`activity_id`);--> statement-breakpoint
CREATE TABLE `course_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'mint' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_course_folders_owner_updated` ON `course_folders` (`trainer_id`,`updated_at`);--> statement-breakpoint
PRAGMA optimize;
