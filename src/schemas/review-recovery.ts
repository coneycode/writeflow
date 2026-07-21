import { z } from "zod";

import { autoFixabilitySchema, narrativeLayerSchema, reviewFailureDiagnosisSchema, targetedRepairPlanSchema, repairVerificationSchema } from "./review-repair";
import { variantReviewSchema } from "./review";

export const recoveryOutcomeSchema = z.enum([
  "planned",
  "repair_applied",
  "verification_failed",
  "rereview_failed",
  "rereview_passed",
  "author_decision_required",
  "auto_repair_exhausted",
  "system_contract_error",
]);

export const issueFingerprintSchema = z.object({
  hash: z.string(),
  severity: z.enum(["blocker", "major", "minor"]),
  issueType: z.string(),
  narrativeLayer: narrativeLayerSchema,
  variantId: z.string().optional(),
  normalizedProblem: z.string(),
  affectedScope: z.array(z.string()).default([]),
});

export const reviewRecoveryAttemptSchema = z.object({
  attempt: z.number().int().min(1),
  inputEditArtifactId: z.string(),
  inputIssueFingerprint: z.string(),
  fingerprints: z.array(issueFingerprintSchema),
  diagnosis: reviewFailureDiagnosisSchema,
  repairPlan: targetedRepairPlanSchema.optional(),
  repairedEditArtifactId: z.string().optional(),
  verification: z.array(z.object({ variantId: z.string(), result: repairVerificationSchema })).default([]).optional(),
  rereview: z.array(variantReviewSchema).default([]).optional(),
  outcome: recoveryOutcomeSchema,
  summary: z.string(),
});

export const reviewRecoveryTraceSchema = z.object({
  chapterTitle: z.string(),
  status: z.enum(["running", "passed", "author_decision_required", "auto_repair_exhausted", "system_contract_error"]),
  maxAttempts: z.number().int().min(1),
  noProgressCount: z.number().int().min(0),
  attempts: z.array(reviewRecoveryAttemptSchema),
  finalAutoFixability: autoFixabilitySchema.optional(),
  finalReason: z.string().optional(),
});

export type IssueFingerprint = z.infer<typeof issueFingerprintSchema>;
export type ReviewRecoveryAttempt = z.infer<typeof reviewRecoveryAttemptSchema>;
export type ReviewRecoveryTrace = z.infer<typeof reviewRecoveryTraceSchema>;
