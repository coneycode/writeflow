import { z } from "zod";

export const reviewIssueSchema = z.object({
  severity: z.enum(["blocker", "major", "minor"]),
  variantId: z.string().optional(),
  location: z.string().optional(),
  problem: z.string(),
  evidence: z.string(),
  suggestedFix: z.string(),
});

export const criticReviewSchema = z.object({
  verdict: z.enum(["pass", "revise", "reject"]),
  summary: z.string(),
  issues: z.array(reviewIssueSchema),
  strongestVariantId: z.string().optional(),
  finalGateRecommendation: z.string(),
});

export const variantReviewSchema = z.object({
  verdict: z.enum(["pass", "revise", "reject"]),
  summary: z.string(),
  issues: z.array(reviewIssueSchema),
  variantId: z.string(),
});

export type ReviewIssue = z.infer<typeof reviewIssueSchema>;
export type CriticReview = z.infer<typeof criticReviewSchema>;
export type VariantReview = z.infer<typeof variantReviewSchema>;
