ALTER TABLE `trainers` ADD `email_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trainers` ADD `verification_hash` text;--> statement-breakpoint
ALTER TABLE `trainers` ADD `verification_expires_at` text;
--> statement-breakpoint
UPDATE `trainers` SET `email_verified` = true WHERE `status` = 'active';
