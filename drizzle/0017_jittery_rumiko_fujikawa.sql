CREATE TABLE `learner_overall_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`assessor_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`score` integer,
	`max_score` integer,
	`public_comment` text DEFAULT '' NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assessor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_learner_overall_assessments_scores" CHECK(("learner_overall_assessments"."score" IS NULL OR "learner_overall_assessments"."score" >= 0) AND ("learner_overall_assessments"."max_score" IS NULL OR "learner_overall_assessments"."max_score" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_overall_assessments_learner` ON `learner_overall_assessments` (`learner_id`);--> statement-breakpoint
CREATE INDEX `idx_learner_overall_assessments_assessor_status` ON `learner_overall_assessments` (`assessor_id`,`status`,`updated_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_learner_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`learner_id` text NOT NULL,
	`activity_id` text,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`score` integer,
	`max_score` integer,
	`learner_comment` text DEFAULT '' NOT NULL,
	`trainer_comment` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `learner_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `pedago_activities`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_learner_submissions_size" CHECK("__new_learner_submissions"."size_bytes" BETWEEN 1 AND 26214400),
	CONSTRAINT "ck_learner_submissions_scores" CHECK(("__new_learner_submissions"."score" IS NULL OR "__new_learner_submissions"."score" >= 0) AND ("__new_learner_submissions"."max_score" IS NULL OR "__new_learner_submissions"."max_score" > 0))
);
--> statement-breakpoint
INSERT INTO `__new_learner_submissions`("id", "assignment_id", "learner_id", "activity_id", "object_key", "original_name", "mime_type", "size_bytes", "status", "score", "max_score", "learner_comment", "trainer_comment", "created_at", "updated_at") SELECT "id", "assignment_id", "learner_id", "activity_id", "object_key", "original_name", "mime_type", "size_bytes", "status", NULL, NULL, "learner_comment", "trainer_comment", "created_at", "updated_at" FROM `learner_submissions`;--> statement-breakpoint
DROP TABLE `learner_submissions`;--> statement-breakpoint
ALTER TABLE `__new_learner_submissions` RENAME TO `learner_submissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_learner_submissions_object` ON `learner_submissions` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_learner_submissions_assignment_status` ON `learner_submissions` (`assignment_id`,`status`,`updated_at`);
