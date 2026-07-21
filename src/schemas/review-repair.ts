import { z } from "zod";

import { reviewIssueSchema } from "./review";

export const reviewFailureIssueTypeSchema = z.enum([
  "continuity_conflict",
  "causality_gap",
  "character_motivation_gap",
  "character_consistency_conflict",
  "timeline_conflict",
  "spatial_logic_conflict",
  "worldbuilding_conflict",
  "foreshadowing_missing",
  "payoff_missing",
  "theme_conflict",
  "tone_mismatch",
  "pacing_problem",
  "scene_goal_unclear",
  "information_flow_problem",
  "prose_quality_problem",
  "reader_confusion",
  "strategy_mismatch",
  "author_intent_required",
  "system_issue",
  "unknown",
]);

export const narrativeLayerSchema = z.enum([
  "route",
  "chapter_plan",
  "outline",
  "scene",
  "paragraph",
  "dialogue",
  "character_arc",
  "world_state",
  "memory",
  "final_selection",
  "system",
  "unknown",
]);

export const autoFixabilitySchema = z.enum([
  "safe_auto_fix",
  "likely_auto_fix",
  "needs_author_choice",
  "system_fix_required",
  "unknown",
]);

export const reviewFailureDiagnosisSchema = z.object({
  summary: z.string(),
  diagnoses: z.array(z.object({
    sourceIssueIndex: z.number().int().min(0),
    severity: z.enum(["blocker", "major", "minor"]),
    issueType: reviewFailureIssueTypeSchema,
    narrativeLayer: narrativeLayerSchema,
    affectedScope: z.object({
      scenes: z.array(z.string()).default([]),
      paragraphs: z.array(z.string()).default([]),
      characters: z.array(z.string()).default([]),
      facts: z.array(z.string()).default([]),
    }).default({ scenes: [], paragraphs: [], characters: [], facts: [] }),
    diagnosis: z.string(),
    whyItMatters: z.string(),
    autoFixability: autoFixabilitySchema,
    defaultRepairIntent: z.string().optional(),
    authorQuestion: z.object({
      question: z.string(),
      options: z.array(z.object({
        id: z.string(),
        label: z.string(),
        consequence: z.string(),
      })).min(2).max(4),
    }).optional(),
  })).min(1),
  overallAutoFixability: autoFixabilitySchema,
  rationale: z.string(),
});

export const targetedRepairPlanSchema = z.object({
  repairLevel: z.enum([
    "paragraph",
    "scene",
    "multi_scene",
    "outline",
    "chapter_strategy",
    "memory",
    "final_selection",
    "author_choice",
    "system_attention",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  repairIntent: z.string(),
  preserve: z.array(z.string()),
  change: z.array(z.string()),
  forbiddenChanges: z.array(z.string()),
  affectedSegments: z.array(z.string()),
  patchInstructions: z.array(z.string()).min(1),
  verificationQuestions: z.array(z.string()).min(1),
  fallbackIfStillFails: z.enum([
    "retry_with_narrower_patch",
    "escalate_to_outline_repair",
    "ask_author",
    "system_attention",
  ]),
});

export const repairVerificationSchema = z.object({
  issueResolved: z.boolean(),
  resolutionConfidence: z.enum(["high", "medium", "low"]),
  remainingProblem: z.string().optional(),
  introducedRegressions: z.array(z.string()).default([]),
  shouldRunFullReview: z.boolean(),
  rationale: z.string(),
});

export const targetedRepairResultSchema = z.object({
  manuscript: z.string(),
  changesMade: z.array(z.string()),
  remainingConcerns: z.array(z.string()),
});

export type ReviewFailureDiagnosis = z.infer<typeof reviewFailureDiagnosisSchema>;
export type TargetedRepairPlan = z.infer<typeof targetedRepairPlanSchema>;
export type RepairVerification = z.infer<typeof repairVerificationSchema>;
export type TargetedRepairResult = z.infer<typeof targetedRepairResultSchema>;

export type ReviewFailureIssue = z.infer<typeof reviewIssueSchema>;
