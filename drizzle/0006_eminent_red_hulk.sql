CREATE TABLE `trainer_ai_settings` (
	`trainer_id` integer PRIMARY KEY NOT NULL,
	`encrypted_key` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `trainer_ai_settings` (`trainer_id`, `encrypted_key`, `updated_at`)
SELECT `trainers`.`id`, `app_settings`.`value`, CURRENT_TIMESTAMP
FROM `trainers`
INNER JOIN `app_settings` ON `app_settings`.`key` = 'openai_api_key_encrypted'
WHERE `trainers`.`role` = 'admin'
ORDER BY `trainers`.`id`
LIMIT 1;
--> statement-breakpoint
DELETE FROM `app_settings` WHERE `key` = 'openai_api_key_encrypted';
