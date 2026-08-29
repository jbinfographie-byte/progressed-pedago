PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `main_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sector` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`cover_image_url` text,
	`color` text DEFAULT 'mint' NOT NULL,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`competencies_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_main_folders_owner_updated` ON `main_folders` (`trainer_id`,`updated_at`);
--> statement-breakpoint
INSERT INTO `main_folders` (
	`id`, `trainer_id`, `name`, `description`, `sector`, `audience`, `cover_image_url`, `color`,
	`keywords_json`, `competencies_json`, `created_at`, `updated_at`
)
SELECT
	'legacy-' || `trainer_id`, `trainer_id`, 'Mes formations existantes',
	'Dossier créé automatiquement pour conserver les dossiers et parcours déjà présents.',
	'', '', NULL, 'mint', '[]', '[]', MIN(`created_at`), MAX(`updated_at`)
FROM `course_folders`
GROUP BY `trainer_id`;
--> statement-breakpoint
CREATE TABLE `__new_course_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`main_folder_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'mint' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`level` text DEFAULT 'debutant' NOT NULL,
	`prerequisites_json` text DEFAULT '[]' NOT NULL,
	`objectives_json` text DEFAULT '[]' NOT NULL,
	`competencies_json` text DEFAULT '[]' NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`cover_image_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`main_folder_id`) REFERENCES `main_folders`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_course_folders_duration_positive" CHECK(`duration_minutes` > 0)
);
--> statement-breakpoint
INSERT INTO `__new_course_folders` (
	`id`, `trainer_id`, `main_folder_id`, `name`, `description`, `color`, `audience`, `level`,
	`prerequisites_json`, `objectives_json`, `competencies_json`, `duration_minutes`,
	`cover_image_url`, `status`, `created_at`, `updated_at`
)
SELECT
	`id`, `trainer_id`, 'legacy-' || `trainer_id`, `name`, `description`, `color`, '', 'debutant',
	'[]', '[]', '[]', 60, NULL, 'draft', `created_at`, `updated_at`
FROM `course_folders`;
--> statement-breakpoint
DROP TABLE `course_folders`;
--> statement-breakpoint
ALTER TABLE `__new_course_folders` RENAME TO `course_folders`;
--> statement-breakpoint
CREATE INDEX `idx_course_folders_owner_updated` ON `course_folders` (`trainer_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_course_folders_main_status` ON `course_folders` (`main_folder_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `learning_paths` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`training_id` text NOT NULL,
	`name` text DEFAULT 'Parcours pédagogique' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`training_id`) REFERENCES `course_folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learning_paths_training` ON `learning_paths` (`training_id`);
--> statement-breakpoint
CREATE INDEX `idx_learning_paths_owner_status` ON `learning_paths` (`trainer_id`,`status`,`updated_at`);
--> statement-breakpoint
INSERT INTO `learning_paths` (`id`, `trainer_id`, `training_id`, `name`, `status`, `created_at`, `updated_at`)
SELECT 'path-' || `id`, `trainer_id`, `id`, 'Parcours · ' || `name`, 'draft', `created_at`, `updated_at`
FROM `course_folders`;
--> statement-breakpoint
CREATE TABLE `learning_path_items` (
	`id` text PRIMARY KEY NOT NULL,
	`path_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`position` integer NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`min_score` integer DEFAULT 0 NOT NULL,
	`unlock_after_previous` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `learning_paths`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_learning_path_position" CHECK("learning_path_items"."position" >= 0),
	CONSTRAINT "ck_learning_path_min_score" CHECK("learning_path_items"."min_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learning_path_activity` ON `learning_path_items` (`path_id`,`activity_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learning_path_position` ON `learning_path_items` (`path_id`,`position`);
--> statement-breakpoint
CREATE INDEX `idx_learning_path_items_activity` ON `learning_path_items` (`activity_id`);
--> statement-breakpoint
INSERT INTO `learning_path_items` (
	`id`, `path_id`, `activity_id`, `position`, `required`, `min_score`,
	`unlock_after_previous`, `created_at`, `updated_at`
)
SELECT
	'path-item-' || `id`, 'path-' || `folder_id`, `activity_id`, `position`, 1, 0, 1, `created_at`, `created_at`
FROM `course_folder_items`;
--> statement-breakpoint
CREATE TABLE `main_folder_files` (
	`id` text PRIMARY KEY NOT NULL,
	`main_folder_id` text NOT NULL,
	`file_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`main_folder_id`) REFERENCES `main_folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_main_folder_file_position" CHECK("main_folder_files"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_main_folder_file` ON `main_folder_files` (`main_folder_id`,`file_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_main_folder_file_position` ON `main_folder_files` (`main_folder_id`,`position`);
--> statement-breakpoint
CREATE INDEX `idx_main_folder_files_file` ON `main_folder_files` (`file_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA optimize;
