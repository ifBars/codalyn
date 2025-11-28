/**
 * Supabase/Postgres schema using Drizzle ORM
 */

import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table (extends Supabase auth.users)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  githubAccessToken: text("github_access_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft | generating | ready | error
  githubRepoUrl: text("github_repo_url"),
  githubRepoName: text("github_repo_name"),
  specJson: jsonb("spec_json"), // JSON object
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sandboxes = pgTable("sandboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // webcontainer | docker
  status: text("status").notNull().default("created"), // created | running | stopped | error
  metadata: jsonb("metadata"), // Additional sandbox info
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiSessions = pgTable("ai_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("planning"), // planning | executing | completed | error
  context: jsonb("context"), // Conversation context
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const toolLogs = pgTable("tool_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => aiSessions.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  inputs: jsonb("inputs").notNull(),
  output: jsonb("output"),
  error: text("error"),
  executionTime: text("execution_time"), // Duration in ms
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fileSnapshots = pgTable("file_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => aiSessions.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  content: text("content").notNull(),
  diff: text("diff"), // Unified diff format
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  vercelUrl: text("vercel_url"),
  status: text("status").notNull().default("pending"), // pending | deployed | failed
  deployedAt: timestamp("deployed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analytics = pgTable("analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  event: text("event").notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

// MDAP Artifacts table
export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => aiSessions.id, { onDelete: "cascade" }),
  artifactId: text("artifact_id").notNull(), // From MDAP artifact.id (nanoid)
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  content: text("content").notNull(),
  mimeType: text("mime_type").notNull(),
  type: text("type").notNull(), // plan | code | markdown | json | image | text | other
  metadata: jsonb("metadata").notNull(), // ArtifactMetadata (agentId, agentRole, description, tags, etc.)
  version: text("version").notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  sessions: many(aiSessions),
  analytics: many(analytics),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  sandboxes: many(sandboxes),
  sessions: many(aiSessions),
  fileSnapshots: many(fileSnapshots),
  deployments: many(deployments),
  analytics: many(analytics),
}));

export const sandboxesRelations = relations(sandboxes, ({ one }) => ({
  project: one(projects, {
    fields: [sandboxes.projectId],
    references: [projects.id],
  }),
}));

export const aiSessionsRelations = relations(aiSessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [aiSessions.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [aiSessions.userId],
    references: [users.id],
  }),
  toolLogs: many(toolLogs),
  fileSnapshots: many(fileSnapshots),
}));

export const toolLogsRelations = relations(toolLogs, ({ one }) => ({
  session: one(aiSessions, {
    fields: [toolLogs.sessionId],
    references: [aiSessions.id],
  }),
}));

export const fileSnapshotsRelations = relations(fileSnapshots, ({ one }) => ({
  project: one(projects, {
    fields: [fileSnapshots.projectId],
    references: [projects.id],
  }),
  session: one(aiSessions, {
    fields: [fileSnapshots.sessionId],
    references: [aiSessions.id],
  }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
}));

export const analyticsRelations = relations(analytics, ({ one }) => ({
  user: one(users, {
    fields: [analytics.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [analytics.projectId],
    references: [projects.id],
  }),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  project: one(projects, {
    fields: [artifacts.projectId],
    references: [projects.id],
  }),
  session: one(aiSessions, {
    fields: [artifacts.sessionId],
    references: [aiSessions.id],
  }),
}));
