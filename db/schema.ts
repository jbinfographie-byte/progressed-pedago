import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  theme: text("theme").notNull(),
  duration: integer("duration").notNull().default(10),
  questionsJson: text("questions_json").notNull().default("[]"),
  researchJson: text("research_json").notNull().default("[]"),
  qualityJson: text("quality_json").notNull().default("{}"),
  imageKey: text("image_key"),
  imageAlt: text("image_alt"),
  source: text("source").notNull().default("manual"),
  externalUrl: text("external_url"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const results = sqliteTable("results", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  learnerName: text("learner_name").notNull(),
  activityTitle: text("activity_title").notNull(),
  activityType: text("activity_type").notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  answersJson: text("answers_json").notNull().default("[]"),
  completedAt: text("completed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const trainers = sqliteTable("trainers", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  email: text("email").notNull().unique(),
  codeHash: text("code_hash").notNull(),
  codeSalt: text("code_salt").notNull(),
  role: text("role").notNull().default("trainer"),
  status: text("status").notNull().default("active"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  lastLoginAt: text("last_login_at"),
  passwordVersion: integer("password_version").notNull().default(2),
  mustChangePassword: integer("must_change_password",{mode:"boolean"}).notNull().default(false),
  emailVerified: integer("email_verified",{mode:"boolean"}).notNull().default(false),
  verificationHash: text("verification_hash"),
  verificationExpiresAt: text("verification_expires_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const trainerSessions = sqliteTable("trainer_sessions", {
  id: text("id").primaryKey(),
  trainerId: integer("trainer_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const authEvents = sqliteTable("auth_events", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  email: text("email").notNull(),
  event: text("event").notNull(),
  detail: text("detail"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
