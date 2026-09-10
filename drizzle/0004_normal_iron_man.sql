CREATE TABLE `course_folder_files` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_id` text NOT NULL,
	`file_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `course_folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_course_folder_file_position" CHECK("course_folder_files"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_course_folder_file` ON `course_folder_files` (`folder_id`,`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_course_folder_file_position` ON `course_folder_files` (`folder_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_course_folder_files_file` ON `course_folder_files` (`file_id`);--> statement-breakpoint
PRAGMA optimize;
