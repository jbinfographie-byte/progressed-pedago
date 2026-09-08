CREATE TABLE `support_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_support_attachments_size" CHECK("support_attachments"."size_bytes" BETWEEN 1 AND 5242880)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_support_attachments_object_key` ON `support_attachments` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_support_attachments_ticket` ON `support_attachments` (`ticket_id`,`created_at`);