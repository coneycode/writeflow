import { z } from "zod";

export const projectTypeSchema = z.enum(["novel", "story_edit", "proposal"]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120),
  type: projectTypeSchema.default("novel"),
  description: z.string().trim().max(500).default(""),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
