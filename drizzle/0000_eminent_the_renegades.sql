CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`theme` text NOT NULL,
	`duration` integer DEFAULT 10 NOT NULL,
	`questions_json` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_name` text NOT NULL,
	`activity_title` text NOT NULL,
	`activity_type` text NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`answers_json` text DEFAULT '[]' NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
