CREATE TABLE `learner_account_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`learner_id` text NOT NULL,
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
	FOREIGN KEY (`assignment_id`) REFERENCES `learner_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_learner_account_progress_attempts" CHECK("learner_account_progress"."attempts" >= 0),
	CONSTRAINT "ck_learner_account_progress_duration" CHECK("learner_account_progress"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_account_progress` ON `learner_account_progress` (`assignment_id`,`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_learner_account_progress_learner` ON `learner_account_progress` (`learner_id`,`updated_at`);