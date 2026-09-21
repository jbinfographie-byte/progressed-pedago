CREATE TABLE "activation_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_hint" text DEFAULT '' NOT NULL,
	"expires_at" integer NOT NULL,
	"used_at" integer,
	"created_by" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedago_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"theme" text NOT NULL,
	"audience" text,
	"level" text DEFAULT 'debutant' NOT NULL,
	"objectives_json" text DEFAULT '[]' NOT NULL,
	"duration_minutes" integer DEFAULT 10 NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"content_json" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"correction" text DEFAULT '' NOT NULL,
	"sources_json" text DEFAULT '[]' NOT NULL,
	"image_object_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"quality_score" integer DEFAULT 0 NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_activities_duration_positive" CHECK ("pedago_activities"."duration_minutes" > 0),
	CONSTRAINT "ck_activities_quality_range" CHECK ("pedago_activities"."quality_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "activity_contents" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content_json" text NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feature" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"audio_seconds" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micros" integer DEFAULT 0 NOT NULL,
	"actual_cost_micros" integer,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"request_id" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_ai_usage_events_amounts" CHECK ("ai_usage_events"."input_tokens" >= 0 AND "ai_usage_events"."output_tokens" >= 0 AND "ai_usage_events"."audio_seconds" >= 0 AND "ai_usage_events"."estimated_cost_micros" >= 0 AND "ai_usage_events"."credits_charged" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pedago_app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value_json" text NOT NULL,
	"updated_by" text,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"ip_hash" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_folder_files" (
	"id" text PRIMARY KEY NOT NULL,
	"folder_id" text NOT NULL,
	"file_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_course_folder_file_position" CHECK ("course_folder_files"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "course_folder_items" (
	"id" text PRIMARY KEY NOT NULL,
	"folder_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_course_folder_position" CHECK ("course_folder_items"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "course_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"main_folder_id" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT 'mint' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"level" text DEFAULT 'debutant' NOT NULL,
	"prerequisites_json" text DEFAULT '[]' NOT NULL,
	"objectives_json" text DEFAULT '[]' NOT NULL,
	"competencies_json" text DEFAULT '[]' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"cover_image_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_course_folders_duration_positive" CHECK ("course_folders"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"actor_id" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_credit_transactions_balance" CHECK ("credit_transactions"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "document_activity_links" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"file_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"pages_json" text DEFAULT '[]' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"page_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"text_content" text NOT NULL,
	"keywords_json" text DEFAULT '[]' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_indexes" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"algorithm" text DEFAULT 'page-summary-v1' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"index_json" text DEFAULT '{}' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"page_number" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"notions_json" text DEFAULT '[]' NOT NULL,
	"procedures_json" text DEFAULT '[]' NOT NULL,
	"risks_json" text DEFAULT '[]' NOT NULL,
	"rules_json" text DEFAULT '[]' NOT NULL,
	"examples_json" text DEFAULT '[]' NOT NULL,
	"audiences_json" text DEFAULT '[]' NOT NULL,
	"objectives_json" text DEFAULT '[]' NOT NULL,
	"level" text DEFAULT 'debutant' NOT NULL,
	"reading_quality" text DEFAULT 'good' NOT NULL,
	"warnings_json" text DEFAULT '[]' NOT NULL,
	"excluded_information_json" text DEFAULT '[]' NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"trainer_notes" text DEFAULT '' NOT NULL,
	"validated_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_document_pages_page_positive" CHECK ("document_pages"."page_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "encrypted_api_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"last_four" text NOT NULL,
	"model" text DEFAULT 'gpt-5.5' NOT NULL,
	"validated_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"category" text DEFAULT 'Autre' NOT NULL,
	"provider" text DEFAULT 'other' NOT NULL,
	"resource_type" text DEFAULT 'link' NOT NULL,
	"training_id" text,
	"activity_id" text,
	"placement" text DEFAULT 'course' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"open_mode" text DEFAULT 'new_tab' NOT NULL,
	"embed_url" text,
	"thumbnail_url" text,
	"external_id" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"file_id" text,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_generation_jobs_attempt_positive" CHECK ("generation_jobs"."attempt" > 0),
	CONSTRAINT "ck_generation_jobs_progress_range" CHECK ("generation_jobs"."progress" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"keywords_json" text DEFAULT '[]' NOT NULL,
	"feature" text DEFAULT 'general' NOT NULL,
	"plans_json" text DEFAULT '[]' NOT NULL,
	"media_url" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_account_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"learner_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"score" integer,
	"max_score" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"answers_json" text DEFAULT '[]' NOT NULL,
	"started_at" integer,
	"completed_at" integer,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_learner_account_progress_attempts" CHECK ("learner_account_progress"."attempts" >= 0),
	CONSTRAINT "ck_learner_account_progress_duration" CHECK ("learner_account_progress"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "learner_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"training_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"share_id" text,
	"starts_at" integer,
	"due_at" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"order_mode" text DEFAULT 'sequential' NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"result_visible" boolean DEFAULT true NOT NULL,
	"comments_visible" boolean DEFAULT true NOT NULL,
	"upload_allowed" boolean DEFAULT true NOT NULL,
	"chat_allowed" boolean DEFAULT true NOT NULL,
	"voice_allowed" boolean DEFAULT true NOT NULL,
	"voice_duration_seconds" integer DEFAULT 600 NOT NULL,
	"manual_validation" boolean DEFAULT false NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_learner_assignment_attempts" CHECK ("learner_assignments"."max_attempts" BETWEEN 1 AND 100),
	CONSTRAINT "ck_learner_assignment_voice_duration" CHECK ("learner_assignments"."voice_duration_seconds" BETWEEN 60 AND 7200)
);
--> statement-breakpoint
CREATE TABLE "learner_evaluation_history" (
	"id" text PRIMARY KEY NOT NULL,
	"evaluation_id" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"before_json" text DEFAULT '{}' NOT NULL,
	"after_json" text DEFAULT '{}' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"learner_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"score" integer,
	"max_score" integer,
	"public_comment" text DEFAULT '' NOT NULL,
	"internal_note" text DEFAULT '' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_learner_evaluation_scores" CHECK (("learner_evaluations"."score" IS NULL OR "learner_evaluations"."score" >= 0) AND ("learner_evaluations"."max_score" IS NULL OR "learner_evaluations"."max_score" > 0))
);
--> statement-breakpoint
CREATE TABLE "learner_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"organization" text DEFAULT '' NOT NULL,
	"group_name" text DEFAULT '' NOT NULL,
	"assigned_trainer_id" text,
	"training_ids_json" text DEFAULT '[]' NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" integer NOT NULL,
	"created_by" text,
	"used_by" text,
	"used_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"read_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"read_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_overall_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"assessor_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"score" integer,
	"max_score" integer,
	"public_comment" text DEFAULT '' NOT NULL,
	"internal_note" text DEFAULT '' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_learner_overall_assessments_scores" CHECK (("learner_overall_assessments"."score" IS NULL OR "learner_overall_assessments"."score" >= 0) AND ("learner_overall_assessments"."max_score" IS NULL OR "learner_overall_assessments"."max_score" > 0))
);
--> statement-breakpoint
CREATE TABLE "learner_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"share_id" text NOT NULL,
	"browser_token_hash" text NOT NULL,
	"resume_code_hash" text NOT NULL,
	"display_name" text DEFAULT 'Apprenant anonyme' NOT NULL,
	"learner_id" text,
	"email" text,
	"identity_kind" text DEFAULT 'anonymous' NOT NULL,
	"last_path_item_id" text,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"started_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"last_seen_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"completed_at" integer,
	CONSTRAINT "ck_learner_participants_progress" CHECK ("learner_participants"."progress_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "learner_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization" text DEFAULT '' NOT NULL,
	"group_name" text DEFAULT '' NOT NULL,
	"assigned_trainer_id" text,
	"privacy_accepted_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"path_item_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"score" integer,
	"max_score" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"answers_json" text DEFAULT '[]' NOT NULL,
	"started_at" integer,
	"completed_at" integer,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_learner_progress_attempts" CHECK ("learner_progress"."attempts" >= 0),
	CONSTRAINT "ck_learner_progress_duration" CHECK ("learner_progress"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "learner_results" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"training_id" text,
	"path_id" text,
	"share_id" text,
	"participant_id" text,
	"learner_first_name" text NOT NULL,
	"learner_last_name" text NOT NULL,
	"answers_json" text DEFAULT '[]' NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"percentage" integer NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"self_evaluation" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_results_score" CHECK ("learner_results"."score" >= 0 AND "learner_results"."max_score" > 0),
	CONSTRAINT "ck_results_percentage" CHECK ("learner_results"."percentage" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "learner_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"learner_id" text NOT NULL,
	"activity_id" text,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"score" integer,
	"max_score" integer,
	"learner_comment" text DEFAULT '' NOT NULL,
	"trainer_comment" text DEFAULT '' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_learner_submissions_size" CHECK ("learner_submissions"."size_bytes" BETWEEN 1 AND 26214400),
	CONSTRAINT "ck_learner_submissions_scores" CHECK (("learner_submissions"."score" IS NULL OR "learner_submissions"."score" >= 0) AND ("learner_submissions"."max_score" IS NULL OR "learner_submissions"."max_score" > 0))
);
--> statement-breakpoint
CREATE TABLE "learning_path_items" (
	"id" text PRIMARY KEY NOT NULL,
	"path_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"position" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"min_score" integer DEFAULT 0 NOT NULL,
	"unlock_after_previous" boolean DEFAULT true NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_learning_path_position" CHECK ("learning_path_items"."position" >= 0),
	CONSTRAINT "ck_learning_path_min_score" CHECK ("learning_path_items"."min_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"training_id" text NOT NULL,
	"name" text DEFAULT 'Parcours pédagogique' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"content_json" text NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"email_hash" text NOT NULL,
	"ip_hash" text,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "main_folder_files" (
	"id" text PRIMARY KEY NOT NULL,
	"main_folder_id" text NOT NULL,
	"file_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_main_folder_file_position" CHECK ("main_folder_files"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "main_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sector" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"cover_image_url" text,
	"color" text DEFAULT 'mint' NOT NULL,
	"keywords_json" text DEFAULT '[]' NOT NULL,
	"competencies_json" text DEFAULT '[]' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_authorizations" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"provider" text NOT NULL,
	"state_hash" text NOT NULL,
	"verifier_ciphertext" text NOT NULL,
	"verifier_iv" text NOT NULL,
	"return_to" text DEFAULT '/' NOT NULL,
	"expires_at" integer NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" integer NOT NULL,
	"used_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"account_label" text DEFAULT '' NOT NULL,
	"access_token_ciphertext" text NOT NULL,
	"access_token_iv" text NOT NULL,
	"refresh_token_ciphertext" text,
	"refresh_token_iv" text,
	"scopes_json" text DEFAULT '[]' NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"expires_at" integer,
	"last_tested_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_access_events" (
	"id" text PRIMARY KEY NOT NULL,
	"share_id" text,
	"ip_hash" text,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_submission_events" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"position" integer NOT NULL,
	"content_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"organization" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"trainer_count" integer DEFAULT 0 NOT NULL,
	"learner_count" integer DEFAULT 0 NOT NULL,
	"primary_need" text NOT NULL,
	"plan_interest" text DEFAULT 'undecided' NOT NULL,
	"wants_demo" boolean DEFAULT false NOT NULL,
	"wants_quote" boolean DEFAULT false NOT NULL,
	"wants_callback" boolean DEFAULT false NOT NULL,
	"preferred_time" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"internal_note" text DEFAULT '' NOT NULL,
	"consented_at" integer NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_choices" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"position" integer NOT NULL,
	"score" integer NOT NULL,
	"content_json" text NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_scenario_choices_score" CHECK ("scenario_choices"."score" BETWEEN 0 AND 2)
);
--> statement-breakpoint
CREATE TABLE "scenario_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"activity_id" text,
	"status" text DEFAULT 'preparing' NOT NULL,
	"file_ids_json" text DEFAULT '[]' NOT NULL,
	"brief_json" text DEFAULT '{}' NOT NULL,
	"settings_json" text DEFAULT '{}' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"project_id" text,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"content_json" text NOT NULL,
	"sources_json" text DEFAULT '[]' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" integer NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"revoked_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_citations" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"file_id" text,
	"scene_id" text,
	"choice_id" text,
	"page_number" integer,
	"passage" text DEFAULT '' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"title" text NOT NULL,
	"organization" text,
	"url" text NOT NULL,
	"accessed_at" integer,
	"used_for" text
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"from_plan_id" text,
	"to_plan_id" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"monthly_voice_seconds" integer DEFAULT 0 NOT NULL,
	"daily_voice_seconds" integer DEFAULT 0 NOT NULL,
	"monthly_credits" integer DEFAULT 0 NOT NULL,
	"monthly_api_budget_micros" integer DEFAULT 0 NOT NULL,
	"features_json" text DEFAULT '{}' NOT NULL,
	"credit_costs_json" text DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_subscription_plans_limits" CHECK ("subscription_plans"."price_cents" >= 0 AND "subscription_plans"."monthly_voice_seconds" >= 0 AND "subscription_plans"."daily_voice_seconds" >= 0 AND "subscription_plans"."monthly_credits" >= 0 AND "subscription_plans"."monthly_api_budget_micros" >= 0)
);
--> statement-breakpoint
CREATE TABLE "support_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_support_attachments_size" CHECK ("support_attachments"."size_bytes" BETWEEN 1 AND 5242880)
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text,
	"author_role" text NOT NULL,
	"message" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"requester_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"organization" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"page_url" text DEFAULT '' NOT NULL,
	"browser_info" text DEFAULT '' NOT NULL,
	"plan_name" text DEFAULT '' NOT NULL,
	"internal_note" text DEFAULT '' NOT NULL,
	"assigned_to" text,
	"consented_at" integer NOT NULL,
	"resolved_at" integer,
	"closed_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainer_access_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"requested_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"decided_at" integer,
	"decided_by" text
);
--> statement-breakpoint
CREATE TABLE "trainer_permissions" (
	"trainer_id" text PRIMARY KEY NOT NULL,
	"access_level" text DEFAULT 'limited' NOT NULL,
	"permissions_json" text DEFAULT '{"createActivities":true,"editActivities":true,"deleteActivities":false,"publishActivities":false,"useAi":false,"uploadDocuments":false,"viewResults":true,"exportResults":false,"manageResources":false,"manageAiConnection":false}' NOT NULL,
	"updated_by" text,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"training_id" text NOT NULL,
	"path_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_ciphertext" text NOT NULL,
	"token_iv" text NOT NULL,
	"short_code" text NOT NULL,
	"mode" text DEFAULT 'home' NOT NULL,
	"live_activity_id" text,
	"identity_mode" text DEFAULT 'name' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"session_open" boolean DEFAULT true NOT NULL,
	"starts_at" integer,
	"expires_at" integer,
	"max_accesses" integer,
	"require_email" boolean DEFAULT false NOT NULL,
	"save_progress" boolean DEFAULT true NOT NULL,
	"save_transcript" boolean DEFAULT false NOT NULL,
	"allow_submission" boolean DEFAULT false NOT NULL,
	"show_result" boolean DEFAULT true NOT NULL,
	"one_time" boolean DEFAULT false NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_training_shares_access_count" CHECK ("training_shares"."access_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" text PRIMARY KEY NOT NULL,
	"trainer_id" text NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"knowledge_folder_id" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"page_count" integer,
	"detected_theme" text,
	"summary" text,
	"keywords_json" text DEFAULT '[]' NOT NULL,
	"analysis_json" text,
	"error_message" text,
	"content_created_count" integer DEFAULT 0 NOT NULL,
	"analyzed_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_feature_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feature" text NOT NULL,
	"allowed" boolean NOT NULL,
	"expires_at" integer,
	"note" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'free' NOT NULL,
	"starts_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"renews_at" integer,
	"ends_at" integer,
	"reset_at" integer NOT NULL,
	"credits_remaining" integer DEFAULT 0 NOT NULL,
	"extra_credits" integer DEFAULT 0 NOT NULL,
	"voice_seconds_month" integer DEFAULT 0 NOT NULL,
	"voice_seconds_day" integer DEFAULT 0 NOT NULL,
	"api_cost_micros_month" integer DEFAULT 0 NOT NULL,
	"voice_monthly_override_seconds" integer,
	"voice_daily_override_seconds" integer,
	"api_budget_override_micros" integer,
	"credits_monthly_override" integer,
	"day_key" text NOT NULL,
	"month_key" text NOT NULL,
	"unlimited" boolean DEFAULT false NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_user_subscriptions_usage" CHECK ("user_subscriptions"."credits_remaining" >= 0 AND "user_subscriptions"."extra_credits" >= 0 AND "user_subscriptions"."voice_seconds_month" >= 0 AND "user_subscriptions"."voice_seconds_day" >= 0 AND "user_subscriptions"."api_cost_micros_month" >= 0 AND ("user_subscriptions"."voice_monthly_override_seconds" IS NULL OR "user_subscriptions"."voice_monthly_override_seconds" >= 0) AND ("user_subscriptions"."voice_daily_override_seconds" IS NULL OR "user_subscriptions"."voice_daily_override_seconds" >= 0) AND ("user_subscriptions"."api_budget_override_micros" IS NULL OR "user_subscriptions"."api_budget_override_micros" >= 0) AND ("user_subscriptions"."credits_monthly_override" IS NULL OR "user_subscriptions"."credits_monthly_override" >= 0))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"first_name" text,
	"last_name" text,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"role" text DEFAULT 'trainer' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"activated_at" integer,
	"last_login_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "ck_users_email_lower" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedago_activities" ADD CONSTRAINT "pedago_activities_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_contents" ADD CONSTRAINT "activity_contents_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedago_app_settings" ADD CONSTRAINT "pedago_app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_folder_files" ADD CONSTRAINT "course_folder_files_folder_id_course_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."course_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_folder_files" ADD CONSTRAINT "course_folder_files_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_folder_items" ADD CONSTRAINT "course_folder_items_folder_id_course_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."course_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_folder_items" ADD CONSTRAINT "course_folder_items_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_folders" ADD CONSTRAINT "course_folders_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_folders" ADD CONSTRAINT "course_folders_main_folder_id_main_folders_id_fk" FOREIGN KEY ("main_folder_id") REFERENCES "public"."main_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_activity_links" ADD CONSTRAINT "document_activity_links_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_activity_links" ADD CONSTRAINT "document_activity_links_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_activity_links" ADD CONSTRAINT "document_activity_links_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_page_id_document_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."document_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_indexes" ADD CONSTRAINT "document_indexes_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_indexes" ADD CONSTRAINT "document_indexes_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encrypted_api_credentials" ADD CONSTRAINT "encrypted_api_credentials_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_training_id_course_folders_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."course_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_folders" ADD CONSTRAINT "knowledge_folders_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_account_progress" ADD CONSTRAINT "learner_account_progress_assignment_id_learner_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."learner_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_account_progress" ADD CONSTRAINT "learner_account_progress_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_account_progress" ADD CONSTRAINT "learner_account_progress_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assignments" ADD CONSTRAINT "learner_assignments_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assignments" ADD CONSTRAINT "learner_assignments_training_id_course_folders_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."course_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assignments" ADD CONSTRAINT "learner_assignments_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assignments" ADD CONSTRAINT "learner_assignments_share_id_training_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."training_shares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_evaluation_history" ADD CONSTRAINT "learner_evaluation_history_evaluation_id_learner_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."learner_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_evaluation_history" ADD CONSTRAINT "learner_evaluation_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_evaluations" ADD CONSTRAINT "learner_evaluations_assignment_id_learner_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."learner_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_evaluations" ADD CONSTRAINT "learner_evaluations_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_evaluations" ADD CONSTRAINT "learner_evaluations_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_evaluations" ADD CONSTRAINT "learner_evaluations_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_invitations" ADD CONSTRAINT "learner_invitations_assigned_trainer_id_users_id_fk" FOREIGN KEY ("assigned_trainer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_invitations" ADD CONSTRAINT "learner_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_invitations" ADD CONSTRAINT "learner_invitations_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_messages" ADD CONSTRAINT "learner_messages_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_messages" ADD CONSTRAINT "learner_messages_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_messages" ADD CONSTRAINT "learner_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_notifications" ADD CONSTRAINT "learner_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_overall_assessments" ADD CONSTRAINT "learner_overall_assessments_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_overall_assessments" ADD CONSTRAINT "learner_overall_assessments_assessor_id_users_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_participants" ADD CONSTRAINT "learner_participants_share_id_training_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."training_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_participants" ADD CONSTRAINT "learner_participants_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_participants" ADD CONSTRAINT "learner_participants_last_path_item_id_learning_path_items_id_fk" FOREIGN KEY ("last_path_item_id") REFERENCES "public"."learning_path_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_assigned_trainer_id_users_id_fk" FOREIGN KEY ("assigned_trainer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_progress" ADD CONSTRAINT "learner_progress_participant_id_learner_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."learner_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_progress" ADD CONSTRAINT "learner_progress_path_item_id_learning_path_items_id_fk" FOREIGN KEY ("path_item_id") REFERENCES "public"."learning_path_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_progress" ADD CONSTRAINT "learner_progress_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_results" ADD CONSTRAINT "learner_results_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_results" ADD CONSTRAINT "learner_results_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_results" ADD CONSTRAINT "learner_results_training_id_course_folders_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."course_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_results" ADD CONSTRAINT "learner_results_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_results" ADD CONSTRAINT "learner_results_share_id_training_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."training_shares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_results" ADD CONSTRAINT "learner_results_participant_id_learner_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."learner_participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_submissions" ADD CONSTRAINT "learner_submissions_assignment_id_learner_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."learner_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_submissions" ADD CONSTRAINT "learner_submissions_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_submissions" ADD CONSTRAINT "learner_submissions_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_items" ADD CONSTRAINT "learning_path_items_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_items" ADD CONSTRAINT "learning_path_items_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_training_id_course_folders_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."course_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main_folder_files" ADD CONSTRAINT "main_folder_files_main_folder_id_main_folders_id_fk" FOREIGN KEY ("main_folder_id") REFERENCES "public"."main_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main_folder_files" ADD CONSTRAINT "main_folder_files_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main_folders" ADD CONSTRAINT "main_folders_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorizations" ADD CONSTRAINT "oauth_authorizations_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_access_events" ADD CONSTRAINT "public_access_events_share_id_training_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."training_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_choices" ADD CONSTRAINT "scenario_choices_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_choices" ADD CONSTRAINT "scenario_choices_scene_id_scenario_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenario_scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_projects" ADD CONSTRAINT "scenario_projects_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_projects" ADD CONSTRAINT "scenario_projects_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_scenes" ADD CONSTRAINT "scenario_scenes_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_scenes" ADD CONSTRAINT "scenario_scenes_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_scenes" ADD CONSTRAINT "scenario_scenes_project_id_scenario_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."scenario_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_citations" ADD CONSTRAINT "source_citations_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_citations" ADD CONSTRAINT "source_citations_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_citations" ADD CONSTRAINT "source_citations_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_activity_id_pedago_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_access_requests" ADD CONSTRAINT "trainer_access_requests_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_access_requests" ADD CONSTRAINT "trainer_access_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_permissions" ADD CONSTRAINT "trainer_permissions_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_permissions" ADD CONSTRAINT "trainer_permissions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_shares" ADD CONSTRAINT "training_shares_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_shares" ADD CONSTRAINT "training_shares_training_id_course_folders_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."course_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_shares" ADD CONSTRAINT "training_shares_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_shares" ADD CONSTRAINT "training_shares_live_activity_id_pedago_activities_id_fk" FOREIGN KEY ("live_activity_id") REFERENCES "public"."pedago_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_knowledge_folder_id_knowledge_folders_id_fk" FOREIGN KEY ("knowledge_folder_id") REFERENCES "public"."knowledge_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feature_overrides" ADD CONSTRAINT "user_feature_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feature_overrides" ADD CONSTRAINT "user_feature_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activation_codes_hash" ON "activation_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "idx_activation_codes_trainer_expiry" ON "activation_codes" USING btree ("trainer_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_pedago_activities_owner_status_date" ON "pedago_activities" USING btree ("trainer_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_pedago_activities_owner_type" ON "pedago_activities" USING btree ("trainer_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activity_content_version" ON "activity_contents" USING btree ("activity_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_usage_events_request" ON "ai_usage_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_events_user_date" ON "ai_usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_events_feature_date" ON "ai_usage_events" USING btree ("feature","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_date" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_date" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_folder_file" ON "course_folder_files" USING btree ("folder_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_folder_file_position" ON "course_folder_files" USING btree ("folder_id","position");--> statement-breakpoint
CREATE INDEX "idx_course_folder_files_file" ON "course_folder_files" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_folder_activity" ON "course_folder_items" USING btree ("folder_id","activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_folder_position" ON "course_folder_items" USING btree ("folder_id","position");--> statement-breakpoint
CREATE INDEX "idx_course_folder_items_activity" ON "course_folder_items" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_course_folders_owner_updated" ON "course_folders" USING btree ("trainer_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_course_folders_main_status" ON "course_folders" USING btree ("main_folder_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_user_date" ON "credit_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_activity_link" ON "document_activity_links" USING btree ("file_id","activity_id");--> statement-breakpoint
CREATE INDEX "idx_document_activity_links_owner_activity" ON "document_activity_links" USING btree ("trainer_id","activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_chunks_page_position" ON "document_chunks" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "idx_document_chunks_owner_file" ON "document_chunks" USING btree ("trainer_id","file_id","page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_indexes_file" ON "document_indexes" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_document_indexes_owner" ON "document_indexes" USING btree ("trainer_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_pages_file_page" ON "document_pages" USING btree ("file_id","page_number");--> statement-breakpoint
CREATE INDEX "idx_document_pages_owner_file" ON "document_pages" USING btree ("trainer_id","file_id","page_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_api_credentials_trainer" ON "encrypted_api_credentials" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "idx_external_resources_owner_category" ON "external_resources" USING btree ("trainer_id","category");--> statement-breakpoint
CREATE INDEX "idx_external_resources_training_activity" ON "external_resources" USING btree ("training_id","activity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_generation_jobs_owner_status" ON "generation_jobs" USING btree ("trainer_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_help_articles_slug" ON "help_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_help_articles_published_feature" ON "help_articles" USING btree ("published","feature","updated_at");--> statement-breakpoint
CREATE INDEX "idx_knowledge_folders_owner_updated" ON "knowledge_folders" USING btree ("trainer_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_account_progress" ON "learner_account_progress" USING btree ("assignment_id","activity_id");--> statement-breakpoint
CREATE INDEX "idx_learner_account_progress_learner" ON "learner_account_progress" USING btree ("learner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_assignment" ON "learner_assignments" USING btree ("learner_id","training_id");--> statement-breakpoint
CREATE INDEX "idx_learner_assignments_trainer_status" ON "learner_assignments" USING btree ("trainer_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_learner_assignments_learner_status" ON "learner_assignments" USING btree ("learner_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_learner_evaluation_history" ON "learner_evaluation_history" USING btree ("evaluation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_evaluation_attempt" ON "learner_evaluations" USING btree ("assignment_id","activity_id","attempt");--> statement-breakpoint
CREATE INDEX "idx_learner_evaluations_trainer_status" ON "learner_evaluations" USING btree ("trainer_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_invitations_token" ON "learner_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_learner_invitations_email_status" ON "learner_invitations" USING btree ("email","status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_learner_messages_conversation" ON "learner_messages" USING btree ("learner_id","trainer_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_learner_notifications_user_read" ON "learner_notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_overall_assessments_learner" ON "learner_overall_assessments" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "idx_learner_overall_assessments_assessor_status" ON "learner_overall_assessments" USING btree ("assessor_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_participants_browser" ON "learner_participants" USING btree ("share_id","browser_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_participants_resume" ON "learner_participants" USING btree ("share_id","resume_code_hash");--> statement-breakpoint
CREATE INDEX "idx_learner_participants_share_seen" ON "learner_participants" USING btree ("share_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_learner_participants_learner" ON "learner_participants" USING btree ("learner_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_learner_profiles_trainer_group" ON "learner_profiles" USING btree ("assigned_trainer_id","group_name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_progress_participant_item" ON "learner_progress" USING btree ("participant_id","path_item_id");--> statement-breakpoint
CREATE INDEX "idx_learner_progress_activity_status" ON "learner_progress" USING btree ("activity_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_results_owner_activity_date" ON "learner_results" USING btree ("trainer_id","activity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_results_owner_training_date" ON "learner_results" USING btree ("trainer_id","training_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_results_share_participant" ON "learner_results" USING btree ("share_id","participant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learner_submissions_object" ON "learner_submissions" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "idx_learner_submissions_assignment_status" ON "learner_submissions" USING btree ("assignment_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learning_path_activity" ON "learning_path_items" USING btree ("path_id","activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learning_path_position" ON "learning_path_items" USING btree ("path_id","position");--> statement-breakpoint
CREATE INDEX "idx_learning_path_items_activity" ON "learning_path_items" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_learning_paths_training" ON "learning_paths" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX "idx_learning_paths_owner_status" ON "learning_paths" USING btree ("trainer_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lessons_activity" ON "lessons" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_email_date" ON "login_attempts" USING btree ("email_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_main_folder_file" ON "main_folder_files" USING btree ("main_folder_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_main_folder_file_position" ON "main_folder_files" USING btree ("main_folder_id","position");--> statement-breakpoint
CREATE INDEX "idx_main_folder_files_file" ON "main_folder_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_main_folders_owner_updated" ON "main_folders" USING btree ("trainer_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_oauth_authorizations_state" ON "oauth_authorizations" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "idx_oauth_authorizations_owner_expiry" ON "oauth_authorizations" USING btree ("trainer_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_password_reset_token_hash" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_password_reset_user_expiry" ON "password_reset_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_provider_connections_owner_provider" ON "provider_connections" USING btree ("trainer_id","provider");--> statement-breakpoint
CREATE INDEX "idx_provider_connections_owner_status" ON "provider_connections" USING btree ("trainer_id","status");--> statement-breakpoint
CREATE INDEX "idx_public_access_events_ip_date" ON "public_access_events" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_public_submission_fingerprint_date" ON "public_submission_events" USING btree ("fingerprint","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_questions_activity_position" ON "questions" USING btree ("activity_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_leads_reference" ON "sales_leads" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_sales_leads_status_date" ON "sales_leads" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_scenario_choices_scene_position" ON "scenario_choices" USING btree ("scene_id","position");--> statement-breakpoint
CREATE INDEX "idx_scenario_choices_owner_scene" ON "scenario_choices" USING btree ("trainer_id","scene_id");--> statement-breakpoint
CREATE INDEX "idx_scenario_projects_owner_status" ON "scenario_projects" USING btree ("trainer_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_scenario_scenes_activity_position" ON "scenario_scenes" USING btree ("activity_id","position");--> statement-breakpoint
CREATE INDEX "idx_scenario_scenes_owner_activity" ON "scenario_scenes" USING btree ("trainer_id","activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sessions_token_hash" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_expiry" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_source_citations_owner_activity" ON "source_citations" USING btree ("trainer_id","activity_id");--> statement-breakpoint
CREATE INDEX "idx_source_citations_file_page" ON "source_citations" USING btree ("file_id","page_number");--> statement-breakpoint
CREATE INDEX "idx_sources_activity" ON "sources" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_user_date" ON "subscription_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_action_date" ON "subscription_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_subscription_plans_active_order" ON "subscription_plans" USING btree ("active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_support_attachments_object_key" ON "support_attachments" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "idx_support_attachments_ticket" ON "support_attachments" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_support_messages_ticket_date" ON "support_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_support_tickets_reference" ON "support_tickets" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_requester_date" ON "support_tickets" USING btree ("requester_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status_priority" ON "support_tickets" USING btree ("status","priority","updated_at");--> statement-breakpoint
CREATE INDEX "idx_access_requests_status_date" ON "trainer_access_requests" USING btree ("status","requested_at");--> statement-breakpoint
CREATE INDEX "idx_access_requests_trainer" ON "trainer_access_requests" USING btree ("trainer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_training_shares_token" ON "training_shares" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_training_shares_short_code" ON "training_shares" USING btree ("short_code");--> statement-breakpoint
CREATE INDEX "idx_training_shares_owner_training" ON "training_shares" USING btree ("trainer_id","training_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_training_shares_status_expiry" ON "training_shares" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_uploaded_files_object_key" ON "uploaded_files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "idx_uploaded_files_owner_status" ON "uploaded_files" USING btree ("trainer_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_feature_override" ON "user_feature_overrides" USING btree ("user_id","feature");--> statement-breakpoint
CREATE INDEX "idx_user_feature_overrides_expiry" ON "user_feature_overrides" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_plan_status" ON "user_subscriptions" USING btree ("plan_id","status");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_reset" ON "user_subscriptions" USING btree ("reset_at","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_status_role" ON "users" USING btree ("status","role");--> statement-breakpoint
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'activation_codes','pedago_activities','activity_contents','ai_usage_events','pedago_app_settings','audit_logs',
    'course_folder_files','course_folder_items','course_folders','credit_transactions','document_activity_links',
    'document_chunks','document_indexes','document_pages','encrypted_api_credentials','external_resources','generation_jobs',
    'help_articles','knowledge_folders','learner_account_progress','learner_assignments','learner_evaluation_history',
    'learner_evaluations','learner_invitations','learner_messages','learner_notifications','learner_overall_assessments',
    'learner_participants','learner_profiles','learner_progress','learner_results','learner_submissions','learning_path_items',
    'learning_paths','lessons','login_attempts','main_folder_files','main_folders','oauth_authorizations',
    'password_reset_tokens','provider_connections','public_access_events','public_submission_events','questions','sales_leads',
    'scenario_choices','scenario_projects','scenario_scenes','sessions','source_citations','sources','subscription_events',
    'subscription_plans','support_attachments','support_messages','support_tickets','trainer_access_requests',
    'trainer_permissions','training_shares','uploaded_files','user_feature_overrides','user_subscriptions','users'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
  END LOOP;
END $$;
