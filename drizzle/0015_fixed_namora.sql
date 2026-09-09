CREATE TABLE `learner_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`training_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`share_id` text,
	`starts_at` integer,
	`due_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`order_mode` text DEFAULT 'sequential' NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`result_visible` integer DEFAULT true NOT NULL,
	`comments_visible` integer DEFAULT true NOT NULL,
	`upload_allowed` integer DEFAULT true NOT NULL,
	`chat_allowed` integer DEFAULT true NOT NULL,
	`voice_allowed` integer DEFAULT true NOT NULL,
	`voice_duration_seconds` integer DEFAULT 600 NOT NULL,
	`manual_validation` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`training_id`) REFERENCES `course_folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`share_id`) REFERENCES `training_shares`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_learner_assignment_attempts" CHECK("learner_assignments"."max_attempts" BETWEEN 1 AND 100),
	CONSTRAINT "ck_learner_assignment_voice_duration" CHECK("learner_assignments"."voice_duration_seconds" BETWEEN 60 AND 7200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_assignment` ON `learner_assignments` (`learner_id`,`training_id`);--> statement-breakpoint
CREATE INDEX `idx_learner_assignments_trainer_status` ON `learner_assignments` (`trainer_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_learner_assignments_learner_status` ON `learner_assignments` (`learner_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `learner_evaluation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_id` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`before_json` text DEFAULT '{}' NOT NULL,
	`after_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `learner_evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_learner_evaluation_history` ON `learner_evaluation_history` (`evaluation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `learner_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`learner_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`score` integer,
	`max_score` integer,
	`public_comment` text DEFAULT '' NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `learner_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_learner_evaluation_scores" CHECK(("learner_evaluations"."score" IS NULL OR "learner_evaluations"."score" >= 0) AND ("learner_evaluations"."max_score" IS NULL OR "learner_evaluations"."max_score" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_evaluation_attempt` ON `learner_evaluations` (`assignment_id`,`activity_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `idx_learner_evaluations_trainer_status` ON `learner_evaluations` (`trainer_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `learner_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`group_name` text DEFAULT '' NOT NULL,
	`assigned_trainer_id` text,
	`training_ids_json` text DEFAULT '[]' NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_by` text,
	`used_by` text,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assigned_trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_invitations_token` ON `learner_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_learner_invitations_email_status` ON `learner_invitations` (`email`,`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `learner_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_learner_messages_conversation` ON `learner_messages` (`learner_id`,`trainer_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `learner_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_learner_notifications_user_read` ON `learner_notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `learner_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`group_name` text DEFAULT '' NOT NULL,
	`assigned_trainer_id` text,
	`privacy_accepted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_learner_profiles_trainer_group` ON `learner_profiles` (`assigned_trainer_id`,`group_name`);--> statement-breakpoint
CREATE TABLE `learner_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`learner_id` text NOT NULL,
	`activity_id` text,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`learner_comment` text DEFAULT '' NOT NULL,
	`trainer_comment` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `learner_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_learner_submissions_size" CHECK("learner_submissions"."size_bytes" BETWEEN 1 AND 26214400)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_submissions_object` ON `learner_submissions` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_learner_submissions_assignment_status` ON `learner_submissions` (`assignment_id`,`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `learner_participants` ADD `learner_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `learner_participants` ADD `email` text;--> statement-breakpoint
CREATE INDEX `idx_learner_participants_learner` ON `learner_participants` (`learner_id`,`last_seen_at`);--> statement-breakpoint
ALTER TABLE `training_shares` ADD `starts_at` integer;--> statement-breakpoint
ALTER TABLE `training_shares` ADD `require_email` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `training_shares` ADD `save_progress` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `training_shares` ADD `save_transcript` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `training_shares` ADD `allow_submission` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `training_shares` ADD `show_result` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `training_shares` ADD `one_time` integer DEFAULT false NOT NULL;