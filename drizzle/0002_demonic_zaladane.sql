CREATE TABLE `trainer_permissions` (
	`trainer_id` text PRIMARY KEY NOT NULL,
	`access_level` text DEFAULT 'limited' NOT NULL,
	`permissions_json` text DEFAULT '{"createActivities":true,"editActivities":true,"deleteActivities":false,"publishActivities":false,"useAi":false,"uploadDocuments":false,"viewResults":true,"exportResults":false,"manageResources":false,"manageAiConnection":false}' NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `users` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_name` text;--> statement-breakpoint
INSERT OR IGNORE INTO `trainer_permissions` (`trainer_id`, `access_level`, `permissions_json`)
SELECT `id`, 'limited', '{"createActivities":true,"editActivities":true,"deleteActivities":false,"publishActivities":false,"useAi":false,"uploadDocuments":false,"viewResults":true,"exportResults":false,"manageResources":false,"manageAiConnection":false}'
FROM `users`
WHERE `role` = 'trainer';
