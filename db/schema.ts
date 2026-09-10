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
  role: text('role', { enum: ['admin', 'trainer', 'learner'] }).notNull().default('trainer'),
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

export const subscriptionPlans = sqliteTable('subscription_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull().default(0),
  currency: text('currency').notNull().default('EUR'),
  monthlyVoiceSeconds: integer('monthly_voice_seconds').notNull().default(0),
  dailyVoiceSeconds: integer('daily_voice_seconds').notNull().default(0),
  monthlyCredits: integer('monthly_credits').notNull().default(0),
  monthlyApiBudgetMicros: integer('monthly_api_budget_micros').notNull().default(0),
  featuresJson: text('features_json').notNull().default('{}'),
  creditCostsJson: text('credit_costs_json').notNull().default('{}'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('idx_subscription_plans_active_order').on(table.active, table.sortOrder),
  check('ck_subscription_plans_limits', sql`${table.priceCents} >= 0 AND ${table.monthlyVoiceSeconds} >= 0 AND ${table.dailyVoiceSeconds} >= 0 AND ${table.monthlyCredits} >= 0 AND ${table.monthlyApiBudgetMicros} >= 0`),
]);

export const userSubscriptions = sqliteTable('user_subscriptions', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => subscriptionPlans.id),
  status: text('status', { enum: ['active', 'trial', 'free', 'suspended', 'expired', 'canceled'] }).notNull().default('free'),
  startsAt: integer('starts_at').notNull().default(now),
  renewsAt: integer('renews_at'),
  endsAt: integer('ends_at'),
  resetAt: integer('reset_at').notNull(),
  creditsRemaining: integer('credits_remaining').notNull().default(0),
  extraCredits: integer('extra_credits').notNull().default(0),
  voiceSecondsMonth: integer('voice_seconds_month').notNull().default(0),
  voiceSecondsDay: integer('voice_seconds_day').notNull().default(0),
  apiCostMicrosMonth: integer('api_cost_micros_month').notNull().default(0),
  voiceMonthlyOverrideSeconds: integer('voice_monthly_override_seconds'),
  voiceDailyOverrideSeconds: integer('voice_daily_override_seconds'),
  apiBudgetOverrideMicros: integer('api_budget_override_micros'),
  creditsMonthlyOverride: integer('credits_monthly_override'),
  dayKey: text('day_key').notNull(),
  monthKey: text('month_key').notNull(),
  unlimited: integer('unlimited', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('idx_user_subscriptions_plan_status').on(table.planId, table.status),
  index('idx_user_subscriptions_reset').on(table.resetAt, table.status),
  check('ck_user_subscriptions_usage', sql`${table.creditsRemaining} >= 0 AND ${table.extraCredits} >= 0 AND ${table.voiceSecondsMonth} >= 0 AND ${table.voiceSecondsDay} >= 0 AND ${table.apiCostMicrosMonth} >= 0 AND (${table.voiceMonthlyOverrideSeconds} IS NULL OR ${table.voiceMonthlyOverrideSeconds} >= 0) AND (${table.voiceDailyOverrideSeconds} IS NULL OR ${table.voiceDailyOverrideSeconds} >= 0) AND (${table.apiBudgetOverrideMicros} IS NULL OR ${table.apiBudgetOverrideMicros} >= 0) AND (${table.creditsMonthlyOverride} IS NULL OR ${table.creditsMonthlyOverride} >= 0)`),
]);

export const userFeatureOverrides = sqliteTable('user_feature_overrides', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  allowed: integer('allowed', { mode: 'boolean' }).notNull(),
  expiresAt: integer('expires_at'),
  note: text('note').notNull().default(''),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_user_feature_override').on(table.userId, table.feature),
  index('idx_user_feature_overrides_expiry').on(table.userId, table.expiresAt),
]);

export const aiUsageEvents = sqliteTable('ai_usage_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  model: text('model').notNull().default(''),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  audioSeconds: integer('audio_seconds').notNull().default(0),
  estimatedCostMicros: integer('estimated_cost_micros').notNull().default(0),
  actualCostMicros: integer('actual_cost_micros'),
  creditsCharged: integer('credits_charged').notNull().default(0),
  requestId: text('request_id'),
  status: text('status', { enum: ['started', 'completed', 'failed', 'blocked'] }).notNull().default('completed'),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_ai_usage_events_request').on(table.requestId),
  index('idx_ai_usage_events_user_date').on(table.userId, table.createdAt),
  index('idx_ai_usage_events_feature_date').on(table.feature, table.createdAt),
  check('ck_ai_usage_events_amounts', sql`${table.inputTokens} >= 0 AND ${table.outputTokens} >= 0 AND ${table.audioSeconds} >= 0 AND ${table.estimatedCostMicros} >= 0 AND ${table.creditsCharged} >= 0`),
]);

export const creditTransactions = sqliteTable('credit_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  kind: text('kind', { enum: ['monthly_reset', 'usage', 'admin_adjustment', 'pack', 'refund'] }).notNull(),
  label: text('label').notNull().default(''),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  index('idx_credit_transactions_user_date').on(table.userId, table.createdAt),
  check('ck_credit_transactions_balance', sql`${table.balanceAfter} >= 0`),
]);

export const subscriptionEvents = sqliteTable('subscription_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  fromPlanId: text('from_plan_id'),
  toPlanId: text('to_plan_id'),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  index('idx_subscription_events_user_date').on(table.userId, table.createdAt),
  index('idx_subscription_events_action_date').on(table.action, table.createdAt),
]);

export const activationCodes = sqliteTable('activation_codes', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  codeHint: text('code_hint').notNull().default(''),
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

export const providerConnections = sqliteTable('provider_connections', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['microsoft', 'google', 'canva'] }).notNull(),
  status: text('status', { enum: ['connected', 'error', 'disconnected'] }).notNull().default('connected'),
  accountLabel: text('account_label').notNull().default(''),
  accessTokenCiphertext: text('access_token_ciphertext').notNull(),
  accessTokenIv: text('access_token_iv').notNull(),
  refreshTokenCiphertext: text('refresh_token_ciphertext'),
  refreshTokenIv: text('refresh_token_iv'),
  scopesJson: text('scopes_json').notNull().default('[]'),
  metadataJson: text('metadata_json').notNull().default('{}'),
  expiresAt: integer('expires_at'),
  lastTestedAt: integer('last_tested_at'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_provider_connections_owner_provider').on(table.trainerId, table.provider),
  index('idx_provider_connections_owner_status').on(table.trainerId, table.status),
]);

export const oauthAuthorizations = sqliteTable('oauth_authorizations', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['microsoft', 'google', 'canva'] }).notNull(),
  stateHash: text('state_hash').notNull(),
  verifierCiphertext: text('verifier_ciphertext').notNull(),
  verifierIv: text('verifier_iv').notNull(),
  returnTo: text('return_to').notNull().default('/'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_oauth_authorizations_state').on(table.stateHash),
  index('idx_oauth_authorizations_owner_expiry').on(table.trainerId, table.expiresAt),
]);

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

export const mainFolders = sqliteTable('main_folders', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  sector: text('sector').notNull().default(''),
  audience: text('audience').notNull().default(''),
  coverImageUrl: text('cover_image_url'),
  color: text('color', { enum: ['mint', 'blue', 'peach', 'aqua'] }).notNull().default('mint'),
  keywordsJson: text('keywords_json').notNull().default('[]'),
  competenciesJson: text('competencies_json').notNull().default('[]'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('idx_main_folders_owner_updated').on(table.trainerId, table.updatedAt),
]);

export const courseFolders = sqliteTable('course_folders', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mainFolderId: text('main_folder_id').references(() => mainFolders.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  color: text('color', { enum: ['mint', 'blue', 'peach', 'aqua'] }).notNull().default('mint'),
  audience: text('audience').notNull().default(''),
  level: text('level', { enum: ['debutant', 'intermediaire', 'avance'] }).notNull().default('debutant'),
  prerequisitesJson: text('prerequisites_json').notNull().default('[]'),
  objectivesJson: text('objectives_json').notNull().default('[]'),
  competenciesJson: text('competencies_json').notNull().default('[]'),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  coverImageUrl: text('cover_image_url'),
  status: text('status', { enum: ['draft', 'ready', 'published', 'archived'] }).notNull().default('draft'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('idx_course_folders_owner_updated').on(table.trainerId, table.updatedAt),
  index('idx_course_folders_main_status').on(table.mainFolderId, table.status, table.updatedAt),
  check('ck_course_folders_duration_positive', sql`${table.durationMinutes} > 0`),
]);

export const learningPaths = sqliteTable('learning_paths', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  trainingId: text('training_id').notNull().references(() => courseFolders.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Parcours pédagogique'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learning_paths_training').on(table.trainingId),
  index('idx_learning_paths_owner_status').on(table.trainerId, table.status, table.updatedAt),
]);

export const learningPathItems = sqliteTable('learning_path_items', {
  id: text('id').primaryKey(),
  pathId: text('path_id').notNull().references(() => learningPaths.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  minScore: integer('min_score').notNull().default(0),
  unlockAfterPrevious: integer('unlock_after_previous', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learning_path_activity').on(table.pathId, table.activityId),
  uniqueIndex('uq_learning_path_position').on(table.pathId, table.position),
  index('idx_learning_path_items_activity').on(table.activityId),
  check('ck_learning_path_position', sql`${table.position} >= 0`),
  check('ck_learning_path_min_score', sql`${table.minScore} BETWEEN 0 AND 100`),
]);

export const trainingShares = sqliteTable('training_shares', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  trainingId: text('training_id').notNull().references(() => courseFolders.id, { onDelete: 'cascade' }),
  pathId: text('path_id').notNull().references(() => learningPaths.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  tokenCiphertext: text('token_ciphertext').notNull(),
  tokenIv: text('token_iv').notNull(),
  shortCode: text('short_code').notNull(),
  mode: text('mode', { enum: ['classroom', 'home'] }).notNull().default('home'),
  liveActivityId: text('live_activity_id').references(() => activities.id, { onDelete: 'set null' }),
  identityMode: text('identity_mode', { enum: ['name', 'pseudonym', 'learner_code', 'anonymous'] }).notNull().default('name'),
  status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),
  sessionOpen: integer('session_open', { mode: 'boolean' }).notNull().default(true),
  startsAt: integer('starts_at'),
  expiresAt: integer('expires_at'),
  maxAccesses: integer('max_accesses'),
  requireEmail: integer('require_email', { mode: 'boolean' }).notNull().default(false),
  saveProgress: integer('save_progress', { mode: 'boolean' }).notNull().default(true),
  saveTranscript: integer('save_transcript', { mode: 'boolean' }).notNull().default(false),
  allowSubmission: integer('allow_submission', { mode: 'boolean' }).notNull().default(false),
  showResult: integer('show_result', { mode: 'boolean' }).notNull().default(true),
  oneTime: integer('one_time', { mode: 'boolean' }).notNull().default(false),
  accessCount: integer('access_count').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_training_shares_token').on(table.tokenHash),
  uniqueIndex('uq_training_shares_short_code').on(table.shortCode),
  index('idx_training_shares_owner_training').on(table.trainerId, table.trainingId, table.updatedAt),
  index('idx_training_shares_status_expiry').on(table.status, table.expiresAt),
  check('ck_training_shares_access_count', sql`${table.accessCount} >= 0`),
]);

export const learnerParticipants = sqliteTable('learner_participants', {
  id: text('id').primaryKey(),
  shareId: text('share_id').notNull().references(() => trainingShares.id, { onDelete: 'cascade' }),
  browserTokenHash: text('browser_token_hash').notNull(),
  resumeCodeHash: text('resume_code_hash').notNull(),
  displayName: text('display_name').notNull().default('Apprenant anonyme'),
  learnerId: text('learner_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email'),
  identityKind: text('identity_kind', { enum: ['name', 'pseudonym', 'learner_code', 'anonymous'] }).notNull().default('anonymous'),
  lastPathItemId: text('last_path_item_id').references(() => learningPathItems.id, { onDelete: 'set null' }),
  progressPercent: integer('progress_percent').notNull().default(0),
  startedAt: integer('started_at').notNull().default(now),
  lastSeenAt: integer('last_seen_at').notNull().default(now),
  completedAt: integer('completed_at'),
}, (table) => [
  uniqueIndex('uq_learner_participants_browser').on(table.shareId, table.browserTokenHash),
  uniqueIndex('uq_learner_participants_resume').on(table.shareId, table.resumeCodeHash),
  index('idx_learner_participants_share_seen').on(table.shareId, table.lastSeenAt),
  index('idx_learner_participants_learner').on(table.learnerId, table.lastSeenAt),
  check('ck_learner_participants_progress', sql`${table.progressPercent} BETWEEN 0 AND 100`),
]);

export const learnerProgress = sqliteTable('learner_progress', {
  id: text('id').primaryKey(),
  participantId: text('participant_id').notNull().references(() => learnerParticipants.id, { onDelete: 'cascade' }),
  pathItemId: text('path_item_id').notNull().references(() => learningPathItems.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['not_started', 'in_progress', 'completed', 'passed', 'retry'] }).notNull().default('not_started'),
  score: integer('score'),
  maxScore: integer('max_score'),
  attempts: integer('attempts').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  answersJson: text('answers_json').notNull().default('[]'),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learner_progress_participant_item').on(table.participantId, table.pathItemId),
  index('idx_learner_progress_activity_status').on(table.activityId, table.status, table.updatedAt),
  check('ck_learner_progress_attempts', sql`${table.attempts} >= 0`),
  check('ck_learner_progress_duration', sql`${table.durationSeconds} >= 0`),
]);

export const publicAccessEvents = sqliteTable('public_access_events', {
  id: text('id').primaryKey(),
  shareId: text('share_id').references(() => trainingShares.id, { onDelete: 'cascade' }),
  ipHash: text('ip_hash'),
  success: integer('success', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_public_access_events_ip_date').on(table.ipHash, table.createdAt)]);

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
  trainingId: text('training_id').references(() => courseFolders.id, { onDelete: 'set null' }), pathId: text('path_id').references(() => learningPaths.id, { onDelete: 'set null' }),
  shareId: text('share_id').references(() => trainingShares.id, { onDelete: 'set null' }), participantId: text('participant_id').references(() => learnerParticipants.id, { onDelete: 'set null' }),
  learnerFirstName: text('learner_first_name').notNull(), learnerLastName: text('learner_last_name').notNull(), answersJson: text('answers_json').notNull().default('[]'),
  score: integer('score').notNull(), maxScore: integer('max_score').notNull(), percentage: integer('percentage').notNull(), durationSeconds: integer('duration_seconds').notNull().default(0),
  attempt: integer('attempt').notNull().default(1), selfEvaluation: text('self_evaluation'), createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_results_owner_activity_date').on(table.trainerId, table.activityId, table.createdAt), index('idx_results_owner_training_date').on(table.trainerId, table.trainingId, table.createdAt), index('idx_results_share_participant').on(table.shareId, table.participantId, table.createdAt), check('ck_results_score', sql`${table.score} >= 0 AND ${table.maxScore} > 0`), check('ck_results_percentage', sql`${table.percentage} BETWEEN 0 AND 100`)]);

export const learnerProfiles = sqliteTable('learner_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  organization: text('organization').notNull().default(''),
  groupName: text('group_name').notNull().default(''),
  assignedTrainerId: text('assigned_trainer_id').references(() => users.id, { onDelete: 'set null' }),
  privacyAcceptedAt: integer('privacy_accepted_at'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [index('idx_learner_profiles_trainer_group').on(table.assignedTrainerId, table.groupName)]);

export const learnerInvitations = sqliteTable('learner_invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  organization: text('organization').notNull().default(''),
  groupName: text('group_name').notNull().default(''),
  assignedTrainerId: text('assigned_trainer_id').references(() => users.id, { onDelete: 'set null' }),
  trainingIdsJson: text('training_ids_json').notNull().default('[]'),
  tokenHash: text('token_hash').notNull(),
  status: text('status', { enum: ['pending', 'used', 'revoked', 'expired'] }).notNull().default('pending'),
  expiresAt: integer('expires_at').notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
  usedAt: integer('used_at'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learner_invitations_token').on(table.tokenHash),
  index('idx_learner_invitations_email_status').on(table.email, table.status, table.expiresAt),
]);

export const learnerAssignments = sqliteTable('learner_assignments', {
  id: text('id').primaryKey(),
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  trainingId: text('training_id').notNull().references(() => courseFolders.id, { onDelete: 'cascade' }),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  shareId: text('share_id').references(() => trainingShares.id, { onDelete: 'set null' }),
  startsAt: integer('starts_at'),
  dueAt: integer('due_at'),
  status: text('status', { enum: ['active', 'paused', 'completed', 'removed'] }).notNull().default('active'),
  orderMode: text('order_mode', { enum: ['sequential', 'free'] }).notNull().default('sequential'),
  maxAttempts: integer('max_attempts').notNull().default(3),
  resultVisible: integer('result_visible', { mode: 'boolean' }).notNull().default(true),
  commentsVisible: integer('comments_visible', { mode: 'boolean' }).notNull().default(true),
  uploadAllowed: integer('upload_allowed', { mode: 'boolean' }).notNull().default(true),
  chatAllowed: integer('chat_allowed', { mode: 'boolean' }).notNull().default(true),
  voiceAllowed: integer('voice_allowed', { mode: 'boolean' }).notNull().default(true),
  voiceDurationSeconds: integer('voice_duration_seconds').notNull().default(600),
  manualValidation: integer('manual_validation', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learner_assignment').on(table.learnerId, table.trainingId),
  index('idx_learner_assignments_trainer_status').on(table.trainerId, table.status, table.updatedAt),
  index('idx_learner_assignments_learner_status').on(table.learnerId, table.status, table.updatedAt),
  check('ck_learner_assignment_attempts', sql`${table.maxAttempts} BETWEEN 1 AND 100`),
  check('ck_learner_assignment_voice_duration', sql`${table.voiceDurationSeconds} BETWEEN 60 AND 7200`),
]);

export const learnerEvaluations = sqliteTable('learner_evaluations', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').notNull().references(() => learnerAssignments.id, { onDelete: 'cascade' }),
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['submitted', 'reviewing', 'validated', 'retry'] }).notNull().default('submitted'),
  score: integer('score'),
  maxScore: integer('max_score'),
  publicComment: text('public_comment').notNull().default(''),
  internalNote: text('internal_note').notNull().default(''),
  attempt: integer('attempt').notNull().default(1),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learner_evaluation_attempt').on(table.assignmentId, table.activityId, table.attempt),
  index('idx_learner_evaluations_trainer_status').on(table.trainerId, table.status, table.updatedAt),
  check('ck_learner_evaluation_scores', sql`(${table.score} IS NULL OR ${table.score} >= 0) AND (${table.maxScore} IS NULL OR ${table.maxScore} > 0)`),
]);

export const learnerAccountProgress = sqliteTable('learner_account_progress', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').notNull().references(() => learnerAssignments.id, { onDelete: 'cascade' }),
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['not_started', 'in_progress', 'submitted', 'reviewing', 'validated', 'completed', 'retry'] }).notNull().default('not_started'),
  score: integer('score'),
  maxScore: integer('max_score'),
  attempts: integer('attempts').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  answersJson: text('answers_json').notNull().default('[]'),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learner_account_progress').on(table.assignmentId, table.activityId),
  index('idx_learner_account_progress_learner').on(table.learnerId, table.updatedAt),
  check('ck_learner_account_progress_attempts', sql`${table.attempts} >= 0`),
  check('ck_learner_account_progress_duration', sql`${table.durationSeconds} >= 0`),
]);

export const learnerEvaluationHistory = sqliteTable('learner_evaluation_history', {
  id: text('id').primaryKey(),
  evaluationId: text('evaluation_id').notNull().references(() => learnerEvaluations.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  beforeJson: text('before_json').notNull().default('{}'),
  afterJson: text('after_json').notNull().default('{}'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_learner_evaluation_history').on(table.evaluationId, table.createdAt)]);

export const learnerSubmissions = sqliteTable('learner_submissions', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').notNull().references(() => learnerAssignments.id, { onDelete: 'cascade' }),
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').references(() => activities.id, { onDelete: 'set null' }),
  objectKey: text('object_key').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  status: text('status', { enum: ['submitted', 'reviewing', 'validated', 'retry'] }).notNull().default('submitted'),
  score: integer('score'),
  maxScore: integer('max_score'),
  learnerComment: text('learner_comment').notNull().default(''),
  trainerComment: text('trainer_comment').notNull().default(''),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learner_submissions_object').on(table.objectKey),
  index('idx_learner_submissions_assignment_status').on(table.assignmentId, table.status, table.updatedAt),
  check('ck_learner_submissions_size', sql`${table.sizeBytes} BETWEEN 1 AND 26214400`),
  check('ck_learner_submissions_scores', sql`(${table.score} IS NULL OR ${table.score} >= 0) AND (${table.maxScore} IS NULL OR ${table.maxScore} > 0)`),
]);

export const learnerOverallAssessments = sqliteTable('learner_overall_assessments', {
  id: text('id').primaryKey(),
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assessorId: text('assessor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['in_progress', 'validated', 'retry'] }).notNull().default('in_progress'),
  score: integer('score'),
  maxScore: integer('max_score'),
  publicComment: text('public_comment').notNull().default(''),
  internalNote: text('internal_note').notNull().default(''),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_learner_overall_assessments_learner').on(table.learnerId),
  index('idx_learner_overall_assessments_assessor_status').on(table.assessorId, table.status, table.updatedAt),
  check('ck_learner_overall_assessments_scores', sql`(${table.score} IS NULL OR ${table.score} >= 0) AND (${table.maxScore} IS NULL OR ${table.maxScore} > 0)`),
]);

export const learnerMessages = sqliteTable('learner_messages', {
  id: text('id').primaryKey(),
  learnerId: text('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_learner_messages_conversation').on(table.learnerId, table.trainerId, table.createdAt)]);

export const learnerNotifications = sqliteTable('learner_notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  link: text('link').notNull().default(''),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_learner_notifications_user_read').on(table.userId, table.readAt, table.createdAt)]);

export const knowledgeFolders = sqliteTable('knowledge_folders', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('idx_knowledge_folders_owner_updated').on(table.trainerId, table.updatedAt),
]);

export const uploadedFiles = sqliteTable('uploaded_files', {
  id: text('id').primaryKey(), trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }), objectKey: text('object_key').notNull(),
  originalName: text('original_name').notNull(), mimeType: text('mime_type').notNull(), sizeBytes: integer('size_bytes').notNull(),
  knowledgeFolderId: text('knowledge_folder_id').references(() => knowledgeFolders.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['uploaded', 'validating', 'extracting', 'analyzing', 'indexed', 'ready', 'failed'] }).notNull().default('uploaded'),
  pageCount: integer('page_count'), detectedTheme: text('detected_theme'), summary: text('summary'), keywordsJson: text('keywords_json').notNull().default('[]'),
  analysisJson: text('analysis_json'), errorMessage: text('error_message'), contentCreatedCount: integer('content_created_count').notNull().default(0),
  analyzedAt: integer('analyzed_at'), createdAt: integer('created_at').notNull().default(now), updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [uniqueIndex('uq_uploaded_files_object_key').on(table.objectKey), index('idx_uploaded_files_owner_status').on(table.trainerId, table.status)]);

export const documentPages = sqliteTable('document_pages', {
  id: text('id').primaryKey(),
  fileId: text('file_id').notNull().references(() => uploadedFiles.id, { onDelete: 'cascade' }),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  title: text('title').notNull().default(''),
  summary: text('summary').notNull().default(''),
  notionsJson: text('notions_json').notNull().default('[]'),
  proceduresJson: text('procedures_json').notNull().default('[]'),
  risksJson: text('risks_json').notNull().default('[]'),
  rulesJson: text('rules_json').notNull().default('[]'),
  examplesJson: text('examples_json').notNull().default('[]'),
  audiencesJson: text('audiences_json').notNull().default('[]'),
  objectivesJson: text('objectives_json').notNull().default('[]'),
  level: text('level', { enum: ['debutant', 'intermediaire', 'avance'] }).notNull().default('debutant'),
  readingQuality: text('reading_quality', { enum: ['good', 'partial', 'illegible'] }).notNull().default('good'),
  warningsJson: text('warnings_json').notNull().default('[]'),
  excludedInformationJson: text('excluded_information_json').notNull().default('[]'),
  selected: integer('selected', { mode: 'boolean' }).notNull().default(true),
  trainerNotes: text('trainer_notes').notNull().default(''),
  validatedAt: integer('validated_at'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_document_pages_file_page').on(table.fileId, table.pageNumber),
  index('idx_document_pages_owner_file').on(table.trainerId, table.fileId, table.pageNumber),
  check('ck_document_pages_page_positive', sql`${table.pageNumber} > 0`),
]);

export const documentChunks = sqliteTable('document_chunks', {
  id: text('id').primaryKey(),
  fileId: text('file_id').notNull().references(() => uploadedFiles.id, { onDelete: 'cascade' }),
  pageId: text('page_id').notNull().references(() => documentPages.id, { onDelete: 'cascade' }),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  title: text('title').notNull().default(''),
  textContent: text('text_content').notNull(),
  keywordsJson: text('keywords_json').notNull().default('[]'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_document_chunks_page_position').on(table.pageId, table.position),
  index('idx_document_chunks_owner_file').on(table.trainerId, table.fileId, table.pageId),
]);

export const documentIndexes = sqliteTable('document_indexes', {
  id: text('id').primaryKey(),
  fileId: text('file_id').notNull().references(() => uploadedFiles.id, { onDelete: 'cascade' }),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  algorithm: text('algorithm').notNull().default('page-summary-v1'),
  chunkCount: integer('chunk_count').notNull().default(0),
  indexJson: text('index_json').notNull().default('{}'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_document_indexes_file').on(table.fileId),
  index('idx_document_indexes_owner').on(table.trainerId, table.updatedAt),
]);

export const generationJobs = sqliteTable('generation_jobs', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileId: text('file_id').references(() => uploadedFiles.id, { onDelete: 'set null' }),
  kind: text('kind', { enum: ['document_analysis', 'scenario_preparation', 'activity_generation'] }).notNull(),
  status: text('status', { enum: ['draft', 'running', 'reviewing', 'ready', 'failed'] }).notNull().default('draft'),
  attempt: integer('attempt').notNull().default(1),
  progress: integer('progress').notNull().default(0),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('idx_generation_jobs_owner_status').on(table.trainerId, table.status, table.updatedAt),
  check('ck_generation_jobs_attempt_positive', sql`${table.attempt} > 0`),
  check('ck_generation_jobs_progress_range', sql`${table.progress} BETWEEN 0 AND 100`),
]);

export const scenarioProjects = sqliteTable('scenario_projects', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').references(() => activities.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['preparing', 'reviewing', 'generating', 'ready', 'failed'] }).notNull().default('preparing'),
  fileIdsJson: text('file_ids_json').notNull().default('[]'),
  briefJson: text('brief_json').notNull().default('{}'),
  settingsJson: text('settings_json').notNull().default('{}'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [index('idx_scenario_projects_owner_status').on(table.trainerId, table.status, table.updatedAt)]);

export const scenarioScenes = sqliteTable('scenario_scenes', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => scenarioProjects.id, { onDelete: 'set null' }),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  contentJson: text('content_json').notNull(),
  sourcesJson: text('sources_json').notNull().default('[]'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_scenario_scenes_activity_position').on(table.activityId, table.position),
  index('idx_scenario_scenes_owner_activity').on(table.trainerId, table.activityId),
]);

export const scenarioChoices = sqliteTable('scenario_choices', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sceneId: text('scene_id').notNull().references(() => scenarioScenes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  score: integer('score').notNull(),
  contentJson: text('content_json').notNull(),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_scenario_choices_scene_position').on(table.sceneId, table.position),
  index('idx_scenario_choices_owner_scene').on(table.trainerId, table.sceneId),
  check('ck_scenario_choices_score', sql`${table.score} BETWEEN 0 AND 2`),
]);

export const documentActivityLinks = sqliteTable('document_activity_links', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileId: text('file_id').notNull().references(() => uploadedFiles.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  pagesJson: text('pages_json').notNull().default('[]'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_document_activity_link').on(table.fileId, table.activityId),
  index('idx_document_activity_links_owner_activity').on(table.trainerId, table.activityId),
]);

export const sourceCitations = sqliteTable('source_citations', {
  id: text('id').primaryKey(),
  trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  fileId: text('file_id').references(() => uploadedFiles.id, { onDelete: 'set null' }),
  sceneId: text('scene_id'),
  choiceId: text('choice_id'),
  pageNumber: integer('page_number'),
  passage: text('passage').notNull().default(''),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  index('idx_source_citations_owner_activity').on(table.trainerId, table.activityId),
  index('idx_source_citations_file_page').on(table.fileId, table.pageNumber),
]);

export const courseFolderFiles = sqliteTable('course_folder_files', {
  id: text('id').primaryKey(),
  folderId: text('folder_id').notNull().references(() => courseFolders.id, { onDelete: 'cascade' }),
  fileId: text('file_id').notNull().references(() => uploadedFiles.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_course_folder_file').on(table.folderId, table.fileId),
  uniqueIndex('uq_course_folder_file_position').on(table.folderId, table.position),
  index('idx_course_folder_files_file').on(table.fileId),
  check('ck_course_folder_file_position', sql`${table.position} >= 0`),
]);

export const mainFolderFiles = sqliteTable('main_folder_files', {
  id: text('id').primaryKey(),
  mainFolderId: text('main_folder_id').notNull().references(() => mainFolders.id, { onDelete: 'cascade' }),
  fileId: text('file_id').notNull().references(() => uploadedFiles.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_main_folder_file').on(table.mainFolderId, table.fileId),
  uniqueIndex('uq_main_folder_file_position').on(table.mainFolderId, table.position),
  index('idx_main_folder_files_file').on(table.fileId),
  check('ck_main_folder_file_position', sql`${table.position} >= 0`),
]);

export const externalResources = sqliteTable('external_resources', {
  id: text('id').primaryKey(), trainerId: text('trainer_id').notNull().references(() => users.id, { onDelete: 'cascade' }), name: text('name').notNull(), url: text('url').notNull(), category: text('category').notNull().default('Autre'),
  provider: text('provider').notNull().default('other'), resourceType: text('resource_type', { enum: ['link', 'video', 'presentation', 'document', 'embed', 'download'] }).notNull().default('link'),
  trainingId: text('training_id').references(() => courseFolders.id, { onDelete: 'cascade' }), activityId: text('activity_id').references(() => activities.id, { onDelete: 'cascade' }),
  placement: text('placement', { enum: ['before', 'after', 'course', 'instructions', 'help'] }).notNull().default('course'), required: integer('required', { mode: 'boolean' }).notNull().default(false),
  openMode: text('open_mode', { enum: ['site', 'new_tab', 'download'] }).notNull().default('new_tab'), embedUrl: text('embed_url'), thumbnailUrl: text('thumbnail_url'), externalId: text('external_id'), metadataJson: text('metadata_json').notNull().default('{}'),
  status: text('status', { enum: ['active', 'blocked'] }).notNull().default('active'), createdAt: integer('created_at').notNull().default(now), updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [index('idx_external_resources_owner_category').on(table.trainerId, table.category), index('idx_external_resources_training_activity').on(table.trainingId, table.activityId, table.createdAt)]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(), actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }), action: text('action').notNull(), targetType: text('target_type').notNull(), targetId: text('target_id'), metadataJson: text('metadata_json').notNull().default('{}'), ipHash: text('ip_hash'), createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_audit_logs_action_date').on(table.action, table.createdAt), index('idx_audit_logs_actor_date').on(table.actorId, table.createdAt)]);

export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(), emailHash: text('email_hash').notNull(), ipHash: text('ip_hash'), success: integer('success', { mode: 'boolean' }).notNull().default(false), createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_login_attempts_email_date').on(table.emailHash, table.createdAt)]);

export const appSettings = sqliteTable('pedago_app_settings', {
  key: text('key').primaryKey(), valueJson: text('value_json').notNull(), updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }), updatedAt: integer('updated_at').notNull().default(now),
});

export const helpArticles = sqliteTable('help_articles', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  summary: text('summary').notNull().default(''),
  content: text('content').notNull(),
  keywordsJson: text('keywords_json').notNull().default('[]'),
  feature: text('feature').notNull().default('general'),
  plansJson: text('plans_json').notNull().default('[]'),
  mediaUrl: text('media_url').notNull().default(''),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_help_articles_slug').on(table.slug),
  index('idx_help_articles_published_feature').on(table.published, table.feature, table.updatedAt),
]);

export const supportTickets = sqliteTable('support_tickets', {
  id: text('id').primaryKey(),
  reference: text('reference').notNull(),
  requesterId: text('requester_id').references(() => users.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  organization: text('organization').notNull().default(''),
  category: text('category').notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  urgency: text('urgency', { enum: ['normal', 'important', 'urgent'] }).notNull().default('normal'),
  status: text('status', { enum: ['new', 'waiting', 'in_progress', 'answered', 'resolved', 'urgent', 'closed'] }).notNull().default('new'),
  priority: text('priority', { enum: ['low', 'normal', 'high', 'critical'] }).notNull().default('normal'),
  pageUrl: text('page_url').notNull().default(''),
  browserInfo: text('browser_info').notNull().default(''),
  planName: text('plan_name').notNull().default(''),
  internalNote: text('internal_note').notNull().default(''),
  assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  consentedAt: integer('consented_at').notNull(),
  resolvedAt: integer('resolved_at'),
  closedAt: integer('closed_at'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_support_tickets_reference').on(table.reference),
  index('idx_support_tickets_requester_date').on(table.requesterId, table.createdAt),
  index('idx_support_tickets_status_priority').on(table.status, table.priority, table.updatedAt),
]);

export const supportMessages = sqliteTable('support_messages', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
  authorRole: text('author_role', { enum: ['requester', 'support'] }).notNull(),
  message: text('message').notNull(),
  internal: integer('internal', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_support_messages_ticket_date').on(table.ticketId, table.createdAt)]);

export const supportAttachments = sqliteTable('support_attachments', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type', { enum: ['image/png', 'image/jpeg', 'application/pdf'] }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_support_attachments_object_key').on(table.objectKey),
  index('idx_support_attachments_ticket').on(table.ticketId, table.createdAt),
  check('ck_support_attachments_size', sql`${table.sizeBytes} BETWEEN 1 AND 5242880`),
]);

export const salesLeads = sqliteTable('sales_leads', {
  id: text('id').primaryKey(),
  reference: text('reference').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  organization: text('organization').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  trainerCount: integer('trainer_count').notNull().default(0),
  learnerCount: integer('learner_count').notNull().default(0),
  primaryNeed: text('primary_need').notNull(),
  planInterest: text('plan_interest', { enum: ['essential', 'coach', 'intensive', 'undecided'] }).notNull().default('undecided'),
  wantsDemo: integer('wants_demo', { mode: 'boolean' }).notNull().default(false),
  wantsQuote: integer('wants_quote', { mode: 'boolean' }).notNull().default(false),
  wantsCallback: integer('wants_callback', { mode: 'boolean' }).notNull().default(false),
  preferredTime: text('preferred_time').notNull().default(''),
  message: text('message').notNull().default(''),
  status: text('status', { enum: ['new', 'callback', 'demo', 'quote', 'proposal', 'follow_up', 'accepted', 'refused'] }).notNull().default('new'),
  internalNote: text('internal_note').notNull().default(''),
  consentedAt: integer('consented_at').notNull(),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  uniqueIndex('uq_sales_leads_reference').on(table.reference),
  index('idx_sales_leads_status_date').on(table.status, table.updatedAt),
]);

export const publicSubmissionEvents = sqliteTable('public_submission_events', {
  id: text('id').primaryKey(),
  fingerprint: text('fingerprint').notNull(),
  kind: text('kind', { enum: ['support', 'sales'] }).notNull(),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [index('idx_public_submission_fingerprint_date').on(table.fingerprint, table.createdAt)]);
