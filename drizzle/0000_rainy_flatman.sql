CREATE TABLE `activation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_activation_codes_hash` ON `activation_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_activation_codes_trainer_expiry` ON `activation_codes` (`trainer_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`theme` text NOT NULL,
	`audience` text,
	`level` text DEFAULT 'debutant' NOT NULL,
	`objectives_json` text DEFAULT '[]' NOT NULL,
	`duration_minutes` integer DEFAULT 10 NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`content_json` text NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`correction` text DEFAULT '' NOT NULL,
	`sources_json` text DEFAULT '[]' NOT NULL,
	`image_object_key` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`quality_score` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_activities_duration_positive" CHECK("activities"."duration_minutes" > 0),
	CONSTRAINT "ck_activities_quality_range" CHECK("activities"."quality_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE INDEX `idx_activities_owner_status_date` ON `activities` (`trainer_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activities_owner_type` ON `activities` (`trainer_id`,`type`);--> statement-breakpoint
CREATE TABLE `activity_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`content_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_activity_content_version` ON `activity_contents` (`activity_id`,`version`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action_date` ON `audit_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor_date` ON `audit_logs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `encrypted_api_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`last_four` text NOT NULL,
	`model` text DEFAULT 'gpt-5.5' NOT NULL,
	`validated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_api_credentials_trainer` ON `encrypted_api_credentials` (`trainer_id`);--> statement-breakpoint
CREATE TABLE `external_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`category` text DEFAULT 'Autre' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_external_resources_owner_category` ON `external_resources` (`trainer_id`,`category`);--> statement-breakpoint
CREATE TABLE `learner_results` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`learner_first_name` text NOT NULL,
	`learner_last_name` text NOT NULL,
	`answers_json` text DEFAULT '[]' NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`percentage` integer NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`self_evaluation` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_results_score" CHECK("learner_results"."score" >= 0 AND "learner_results"."max_score" > 0),
	CONSTRAINT "ck_results_percentage" CHECK("learner_results"."percentage" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE INDEX `idx_results_owner_activity_date` ON `learner_results` (`trainer_id`,`activity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`content_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_lessons_activity` ON `lessons` (`activity_id`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`ip_hash` text,
	`success` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_login_attempts_email_date` ON `login_attempts` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`position` integer NOT NULL,
	`content_json` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_questions_activity_position` ON `questions` (`activity_id`,`position`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_hash` text,
	`user_agent` text,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_expiry` ON `sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`title` text NOT NULL,
	`organization` text,
	`url` text NOT NULL,
	`accessed_at` integer,
	`used_for` text,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sources_activity` ON `sources` (`activity_id`);--> statement-breakpoint
CREATE TABLE `trainer_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`requested_at` integer DEFAULT (unixepoch()) NOT NULL,
	`decided_at` integer,
	`decided_by` text,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_access_requests_status_date` ON `trainer_access_requests` (`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `idx_access_requests_trainer` ON `trainer_access_requests` (`trainer_id`);--> statement-breakpoint
CREATE TABLE `uploaded_files` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`page_count` integer,
	`analysis_json` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_uploaded_files_object_key` ON `uploaded_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_uploaded_files_owner_status` ON `uploaded_files` (`trainer_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text DEFAULT 'trainer' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`activated_at` integer,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "ck_users_email_lower" CHECK("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_status_role` ON `users` (`status`,`role`);--> statement-breakpoint
PRAGMA optimize;
