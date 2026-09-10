ALTER TABLE `learner_results` ADD `training_id` text REFERENCES course_folders(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `learner_results` ADD `path_id` text REFERENCES learning_paths(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `idx_results_owner_training_date` ON `learner_results` (`trainer_id`,`training_id`,`created_at`);
