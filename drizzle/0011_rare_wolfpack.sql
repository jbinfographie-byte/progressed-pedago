CREATE TABLE `ai_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feature` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`audio_seconds` integer DEFAULT 0 NOT NULL,
	`estimated_cost_micros` integer DEFAULT 0 NOT NULL,
	`actual_cost_micros` integer,
	`credits_charged` integer DEFAULT 0 NOT NULL,
	`request_id` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_ai_usage_events_amounts" CHECK("ai_usage_events"."input_tokens" >= 0 AND "ai_usage_events"."output_tokens" >= 0 AND "ai_usage_events"."audio_seconds" >= 0 AND "ai_usage_events"."estimated_cost_micros" >= 0 AND "ai_usage_events"."credits_charged" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ai_usage_events_request` ON `ai_usage_events` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_events_user_date` ON `ai_usage_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_events_feature_date` ON `ai_usage_events` (`feature`,`created_at`);--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`actor_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_credit_transactions_balance" CHECK("credit_transactions"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_credit_transactions_user_date` ON `credit_transactions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`from_plan_id` text,
	`to_plan_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_subscription_events_user_date` ON `subscription_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_subscription_events_action_date` ON `subscription_events` (`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`monthly_voice_seconds` integer DEFAULT 0 NOT NULL,
	`daily_voice_seconds` integer DEFAULT 0 NOT NULL,
	`monthly_credits` integer DEFAULT 0 NOT NULL,
	`monthly_api_budget_micros` integer DEFAULT 0 NOT NULL,
	`features_json` text DEFAULT '{}' NOT NULL,
	`credit_costs_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "ck_subscription_plans_limits" CHECK("subscription_plans"."price_cents" >= 0 AND "subscription_plans"."monthly_voice_seconds" >= 0 AND "subscription_plans"."daily_voice_seconds" >= 0 AND "subscription_plans"."monthly_credits" >= 0 AND "subscription_plans"."monthly_api_budget_micros" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_subscription_plans_active_order` ON `subscription_plans` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `user_feature_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feature` text NOT NULL,
	`allowed` integer NOT NULL,
	`expires_at` integer,
	`note` text DEFAULT '' NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_feature_override` ON `user_feature_overrides` (`user_id`,`feature`);--> statement-breakpoint
CREATE INDEX `idx_user_feature_overrides_expiry` ON `user_feature_overrides` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'free' NOT NULL,
	`starts_at` integer DEFAULT (unixepoch()) NOT NULL,
	`renews_at` integer,
	`ends_at` integer,
	`reset_at` integer NOT NULL,
	`credits_remaining` integer DEFAULT 0 NOT NULL,
	`extra_credits` integer DEFAULT 0 NOT NULL,
	`voice_seconds_month` integer DEFAULT 0 NOT NULL,
	`voice_seconds_day` integer DEFAULT 0 NOT NULL,
	`api_cost_micros_month` integer DEFAULT 0 NOT NULL,
	`voice_monthly_override_seconds` integer,
	`voice_daily_override_seconds` integer,
	`api_budget_override_micros` integer,
	`credits_monthly_override` integer,
	`day_key` text NOT NULL,
	`month_key` text NOT NULL,
	`unlimited` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_user_subscriptions_usage" CHECK("user_subscriptions"."credits_remaining" >= 0 AND "user_subscriptions"."extra_credits" >= 0 AND "user_subscriptions"."voice_seconds_month" >= 0 AND "user_subscriptions"."voice_seconds_day" >= 0 AND "user_subscriptions"."api_cost_micros_month" >= 0 AND ("user_subscriptions"."voice_monthly_override_seconds" IS NULL OR "user_subscriptions"."voice_monthly_override_seconds" >= 0) AND ("user_subscriptions"."voice_daily_override_seconds" IS NULL OR "user_subscriptions"."voice_daily_override_seconds" >= 0) AND ("user_subscriptions"."api_budget_override_micros" IS NULL OR "user_subscriptions"."api_budget_override_micros" >= 0) AND ("user_subscriptions"."credits_monthly_override" IS NULL OR "user_subscriptions"."credits_monthly_override" >= 0))
);
--> statement-breakpoint
CREATE INDEX `idx_user_subscriptions_plan_status` ON `user_subscriptions` (`plan_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_user_subscriptions_reset` ON `user_subscriptions` (`reset_at`,`status`);