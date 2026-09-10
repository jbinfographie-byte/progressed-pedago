CREATE TABLE `learner_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`browser_token_hash` text NOT NULL,
	`resume_code_hash` text NOT NULL,
	`display_name` text DEFAULT 'Apprenant anonyme' NOT NULL,
	`identity_kind` text DEFAULT 'anonymous' NOT NULL,
	`last_path_item_id` text,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`share_id`) REFERENCES `training_shares`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_path_item_id`) REFERENCES `learning_path_items`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_learner_participants_progress" CHECK("learner_participants"."progress_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_participants_browser` ON `learner_participants` (`share_id`,`browser_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_participants_resume` ON `learner_participants` (`share_id`,`resume_code_hash`);--> statement-breakpoint
CREATE INDEX `idx_learner_participants_share_seen` ON `learner_participants` (`share_id`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `learner_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`path_item_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`score` integer,
	`max_score` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`answers_json` text DEFAULT '[]' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `learner_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_item_id`) REFERENCES `learning_path_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_learner_progress_attempts" CHECK("learner_progress"."attempts" >= 0),
	CONSTRAINT "ck_learner_progress_duration" CHECK("learner_progress"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_progress_participant_item` ON `learner_progress` (`participant_id`,`path_item_id`);--> statement-breakpoint
CREATE INDEX `idx_learner_progress_activity_status` ON `learner_progress` (`activity_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `oauth_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`provider` text NOT NULL,
	`state_hash` text NOT NULL,
	`verifier_ciphertext` text NOT NULL,
	`verifier_iv` text NOT NULL,
	`return_to` text DEFAULT '/' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_oauth_authorizations_state` ON `oauth_authorizations` (`state_hash`);--> statement-breakpoint
CREATE INDEX `idx_oauth_authorizations_owner_expiry` ON `oauth_authorizations` (`trainer_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `provider_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`account_label` text DEFAULT '' NOT NULL,
	`access_token_ciphertext` text NOT NULL,
	`access_token_iv` text NOT NULL,
	`refresh_token_ciphertext` text,
	`refresh_token_iv` text,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`expires_at` integer,
	`last_tested_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_provider_connections_owner_provider` ON `provider_connections` (`trainer_id`,`provider`);--> statement-breakpoint
CREATE INDEX `idx_provider_connections_owner_status` ON `provider_connections` (`trainer_id`,`status`);--> statement-breakpoint
CREATE TABLE `public_access_events` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text,
	`ip_hash` text,
	`success` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`share_id`) REFERENCES `training_shares`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_public_access_events_ip_date` ON `public_access_events` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `training_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`training_id` text NOT NULL,
	`path_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_ciphertext` text NOT NULL,
	`token_iv` text NOT NULL,
	`short_code` text NOT NULL,
	`mode` text DEFAULT 'home' NOT NULL,
	`identity_mode` text DEFAULT 'name' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`session_open` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`max_accesses` integer,
	`access_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`training_id`) REFERENCES `course_folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_id`) REFERENCES `learning_paths`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_training_shares_access_count" CHECK("training_shares"."access_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_training_shares_token` ON `training_shares` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_training_shares_short_code` ON `training_shares` (`short_code`);--> statement-breakpoint
CREATE INDEX `idx_training_shares_owner_training` ON `training_shares` (`trainer_id`,`training_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_training_shares_status_expiry` ON `training_shares` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `__new_external_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`category` text DEFAULT 'Autre' NOT NULL,
	`provider` text DEFAULT 'other' NOT NULL,
	`resource_type` text DEFAULT 'link' NOT NULL,
	`training_id` text,
	`activity_id` text,
	`placement` text DEFAULT 'course' NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`open_mode` text DEFAULT 'new_tab' NOT NULL,
	`embed_url` text,
	`thumbnail_url` text,
	`external_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`training_id`) REFERENCES `course_folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_external_resources` (`id`,`trainer_id`,`name`,`url`,`category`,`created_at`,`updated_at`)
SELECT `id`,`trainer_id`,`name`,`url`,`category`,`created_at`,`created_at` FROM `external_resources`;
--> statement-breakpoint
DROP TABLE `external_resources`;
--> statement-breakpoint
ALTER TABLE `__new_external_resources` RENAME TO `external_resources`;
--> statement-breakpoint
CREATE INDEX `idx_external_resources_owner_category` ON `external_resources` (`trainer_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_external_resources_training_activity` ON `external_resources` (`training_id`,`activity_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `learner_results` ADD `share_id` text REFERENCES training_shares(id);--> statement-breakpoint
ALTER TABLE `learner_results` ADD `participant_id` text REFERENCES learner_participants(id);--> statement-breakpoint
CREATE INDEX `idx_results_share_participant` ON `learner_results` (`share_id`,`participant_id`,`created_at`);
