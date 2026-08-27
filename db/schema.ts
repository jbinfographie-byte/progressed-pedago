import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch())`;

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  role: text('role', { enum: ['admin', 'trainer'] }).notNull().default('trainer'),
  status: text('status', { enum: ['pending', 'active', 'suspended', 'revoked'] }).notNull().default('pending'),
  activatedAt: integer('activated_at'),
  lastLoginAt: integer('last_login_at'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_users_email').on(table.email),
  index('idx_users_status_role').on(table.status, table.role),
  check('ck_users_email_lower', sql`${table.email} = lower(${table.email})`),
]);

export const trainerAccessRequests = sqliteTable('trainer_access_requests', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'approved', 'refused'] }).notNull().default('pending'),
  note: text('note'),
  requestedAt: integer('requested_at').notNull().default(now),
  decidedAt: integer('decided_at'),
  decidedBy: text('decided_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  index('idx_access_requests_status_date').on(table.status, table.requestedAt),
  index('idx_access_requests_trainer').on(table.trainerId),
]);

export const trainerPermissions = sqliteTable('trainer_permissions', {
  trainerId: text('trainer_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  accessLevel: text('access_level', { enum: ['limited', 'medium', 'extended', 'custom'] }).notNull().default('limited'),
  permissionsJson: text('permissions_json').notNull().default('{"createActivities":true,"editActivities":true,"deleteActivities":false,"publishActivities":false,"useAi":false,"uploadDocuments":false,"viewResults":true,"exportResults":false,"manageResources":false,"manageAiConnection":false}'),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const activationCodes = sqliteTable('activation_codes', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_activation_codes_hash').on(table.codeHash),
  index('idx_activation_codes_trainer_expiry').on(table.trainerId, table.expiresAt),
]);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  revokedAt: integer('revoked_at'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_sessions_token_hash').on(table.tokenHash),
  index('idx_sessions_user_expiry').on(table.userId, table.expiresAt),
]);

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_password_reset_token_hash').on(table.tokenHash),
  index('idx_password_reset_user_expiry').on(table.userId, table.expiresAt),
]);

export const encryptedApiCredentials = sqliteTable('encrypted_api_credentials', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  lastFour: text('last_four').notNull(),
  model: text('model').notNull().default('gpt-5.5'),
  validatedAt: integer('validated_at'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [uniqueIndex('uq_api_credentials_trainer').on(table.trainerId)]);

export const activities = sqliteTable('pedago_activities', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), title: text('title').notNull(), theme: text('theme').notNull(), audience: text('audience'),
  level: text('level', { enum: ['debutant', 'intermediaire', 'avance'] }).notNull().default('debutant'),
  objectivesJson: text('objectives_json').notNull().default('[]'), durationMinutes: integer('duration_minutes').notNull().default(10),
  instructions: text('instructions').notNull().default(''), contentJson: text('content_json').notNull(),
  explanation: text('explanation').notNull().default(''), correction: text('correction').notNull().default(''), sourcesJson: text('sources_json').notNull().default('[]'),
  imageObjectKey: text('image_object_key'), status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  qualityScore: integer('quality_score').notNull().default(0), createdAt: integer('created_at').notNull().default(now), updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('idx_pedago_activities_owner_status_date').on(table.trainerId, table.status, table.createdAt), index('idx_pedago_activities_owner_type').on(table.trainerId, table.type),
  check('ck_activities_duration_positive', sql`${table.durationMinutes} > 0`), check('ck_activities_quality_range', sql`${table.qualityScore} BETWEEN 0 AND 100`),
]);

export const activityContents = sqliteTable('activity_contents', {
  id: text('id').primaryKey(), activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1), contentJson: text('content_json').notNull(), createdAt: integer('created_at').notNull().default(now),
}, (table) => [uniqueIndex('uq_activity_content_version').on(table.activityId, table.version)]);

export const courseFolders = sqliteTable('course_folders', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  color: text('color', { enum: ['mint', 'blue', 'peach', 'aqua'] }).notNull().default('mint'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('idx_course_folders_owner_updated').on(table.trainerId, table.updatedAt),
]);

export const courseFolderItems = sqliteTable('course_folder_items', {
  id: text('id').primaryKey(),
  folderId: text('folder_id').notNull().references(() => courseFolders.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_course_folder_activity').on(table.folderId, table.activityId),
  uniqueIndex('uq_course_folder_position').on(table.folderId, table.position),
  index('idx_course_folder_items_activity').on(table.activityId),
  check('ck_course_folder_position', sql`${table.position} >= 0`),
]);

export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(), activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(), contentJson: text('content_json').notNull(),
}, (table) => [uniqueIndex('uq_questions_activity_position').on(table.activityId, table.position)]);

export const lessons = sqliteTable('lessons', {
  id: text('id').primaryKey(), activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }), contentJson: text('content_json').notNull(),
  createdAt: integer('created_at').notNull().default(now), updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [uniqueIndex('uq_lessons_activity').on(table.activityId)]);

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(), activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), organization: text('organization'), url: text('url').notNull(), accessedAt: integer('accessed_at'), usedFor: text('used_for'),
}, (table) => [index('idx_sources_activity').on(table.activityId)]);

export const learnerResults = sqliteTable('learner_results', {
  id: text('id').primaryKey(), activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }), trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  learnerFirstName: text('learner_first_name').notNull(), learnerLastName: text('learner_last_name').notNull(), answersJson: text('answers_json').notNull().default('[]'),
  score: integer('score').notNull(), maxScore: integer('max_score').notNull(), percentage: integer('percentage').notNull(), durationSeconds: integer('duration_seconds').notNull().default(0),
  attempt: integer('attempt').notNull().default(1), selfEvaluation: text('self_evaluation'), createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_results_owner_activity_date').on(table.trainerId, table.activityId, table.createdAt), check('ck_results_score', sql`${table.score} >= 0 AND ${table.maxScore} > 0`), check('ck_results_percentage', sql`${table.percentage} BETWEEN 0 AND 100`)]);

export const uploadedFiles = sqliteTable('uploaded_files', {
  id: text('id').primaryKey(), trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }), objectKey: text('object_key').notNull(),
  originalName: text('original_name').notNull(), mimeType: text('mime_type').notNull(), sizeBytes: integer('size_bytes').notNull(),
  status: text('status', { enum: ['uploaded', 'analyzing', 'ready', 'failed'] }).notNull().default('uploaded'), pageCount: integer('page_count'), analysisJson: text('analysis_json'), errorMessage: text('error_message'), createdAt: integer('created_at').notNull().default(now),
}, (table) => [uniqueIndex('uq_uploaded_files_object_key').on(table.objectKey), index('idx_uploaded_files_owner_status').on(table.trainerId, table.status)]);

export const externalResources = sqliteTable('external_resources', {
  id: text('id').primaryKey(), trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }), name: text('name').notNull(), url: text('url').notNull(), category: text('category').notNull().default('Autre'), createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_external_resources_owner_category').on(table.trainerId, table.category)]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(), actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }), action: text('action').notNull(), targetType: text('target_type').notNull(), targetId: text('target_id'), metadataJson: text('metadata_json').notNull().default('{}'), ipHash: text('ip_hash'), createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_audit_logs_action_date').on(table.action, table.createdAt), index('idx_audit_logs_actor_date').on(table.actorId, table.createdAt)]);

export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(), emailHash: text('email_hash').notNull(), ipHash: text('ip_hash'), success: integer('success', { mode: 'boolean' }).notNull().default(false), createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_login_attempts_email_date').on(table.emailHash, table.createdAt)]);

export const appSettings = sqliteTable('pedago_app_settings', {
  key: text('key').primaryKey(), valueJson: text('value_json').notNull(), updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }), updatedAt: integer('updated_at').notNull().default(now),
});
