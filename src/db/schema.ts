import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type", { enum: ["novel", "story_edit", "proposal"] }).notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  rootPath: text("root_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  workflow: text("workflow").notNull(),
  status: text("status", { enum: ["draft", "running", "waiting", "completed", "failed", "cancelled"] }).notNull(),
  currentStep: text("current_step").notNull().default("brief"),
  summary: text("summary").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const runSteps = sqliteTable("run_steps", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  agentId: text("agent_id"),
  stepType: text("step_type", { enum: ["agent", "gate", "system"] }).notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["pending", "running", "waiting", "completed", "failed"] }).notNull(),
  artifactId: text("artifact_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  runId: text("run_id").references(() => runs.id),
  // 上游 artifact 的 id，用于按章节回溯谱系（direction→outline→draft→edit；review→被审对象）。
  parentArtifactId: text("parent_artifact_id"),
  kind: text("kind", { enum: ["brief", "recall", "direction", "outline", "variant_strategy", "draft", "edit", "review", "final_selection", "selected_final", "memory_patch", "memory_patch_applied", "chapter_plan", "context_archive"] }).notNull(),
  title: text("title").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const gates = sqliteTable("gates", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  gateType: text("gate_type", { enum: ["direction", "outline", "final", "memory_patch"] }).notNull(),
  status: text("status", { enum: ["waiting", "approved", "revision_requested", "cancelled"] }).notNull(),
  decision: text("decision"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const projectRelations = relations(projects, ({ many }) => ({
  runs: many(runs),
  artifacts: many(artifacts),
}));

export const runRelations = relations(runs, ({ one, many }) => ({
  project: one(projects, {
    fields: [runs.projectId],
    references: [projects.id],
  }),
  steps: many(runSteps),
  gates: many(gates),
  artifacts: many(artifacts),
}));
