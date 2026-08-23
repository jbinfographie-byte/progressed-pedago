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
