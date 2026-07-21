import { z } from "zod";

import {
  autoFixabilitySchema,
  narrativeLayerSchema,
  reviewFailureDiagnosisSchema,
  reviewFailureIssueTypeSchema,
  type ReviewFailureDiagnosis,
} from "./review-repair";

const issueTypeAliases: Record<string, z.infer<typeof reviewFailureIssueTypeSchema>> = {
  procedural_continuity_conflict: "continuity_conflict",
  continuity_precision_issue: "continuity_conflict",
  continuity_issue: "continuity_conflict",
  procedural_plausibility_gap: "causality_gap",
  plausibility_gap: "causality_gap",
  timeline_clarity_issue: "timeline_conflict",
  timeline_confusion: "timeline_conflict",
  diction_register_mismatch: "tone_mismatch",
  tonal_register_mismatch: "tone_mismatch",
  register_mismatch: "tone_mismatch",
  style_mismatch: "tone_mismatch",
  style_issue: "prose_quality_problem",
  prose_style_issue: "prose_quality_problem",
  clarity_issue: "reader_confusion",
  reader_clarity_issue: "reader_confusion",
  motivation_gap: "character_motivation_gap",
  character_logic_gap: "character_motivation_gap",
};

const narrativeLayerAliases: Record<string, z.infer<typeof narrativeLayerSchema>> = {
  chapter: "chapter_plan",
  chapter_outline: "outline",
  beat_sheet: "outline",
  draft: "scene",
  prose: "paragraph",
  style: "paragraph",
  tone: "paragraph",
  character: "character_arc",
  canon: "memory",
  timeline: "memory",
  setting: "world_state",
  worldbuilding: "world_state",
  selection: "final_selection",
  runtime: "system",
  config: "system",
};

const autoFixabilityAliases: Record<string, z.infer<typeof autoFixabilitySchema>> = {
  auto_fixable: "likely_auto_fix",
  fixable: "likely_auto_fix",
  safe: "safe_auto_fix",
  likely: "likely_auto_fix",
  author_choice: "needs_author_choice",
  author_decision_required: "needs_author_choice",
  needs_author_decision: "needs_author_choice",
  system_issue: "system_fix_required",
  needs_system_fix: "system_fix_required",
};

function canonicalString(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : undefined;
}

function normalizeEnum<T extends string>(value: unknown, schema: z.ZodEnum<Record<string, T>>, aliases: Record<string, T>, fallback: T) {
  const key = canonicalString(value);
  if (!key) {
    return fallback;
  }
  const parsed = schema.safeParse(key);
  if (parsed.success) {
    return parsed.data;
  }
  return aliases[key] ?? fallback;
}

function normalizeAffectedScope(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { scenes: [], paragraphs: [], characters: [], facts: [] };
  }
  const record = value as Record<string, unknown>;
  return {
    scenes: Array.isArray(record.scenes) ? record.scenes.filter((item): item is string => typeof item === "string") : [],
    paragraphs: Array.isArray(record.paragraphs) ? record.paragraphs.filter((item): item is string => typeof item === "string") : [],
    characters: Array.isArray(record.characters) ? record.characters.filter((item): item is string => typeof item === "string") : [],
    facts: Array.isArray(record.facts) ? record.facts.filter((item): item is string => typeof item === "string") : [],
  };
}

export function normalizeReviewFailureDiagnosisOutput(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const root = { ...(value as Record<string, unknown>) };
  const diagnoses = Array.isArray(root.diagnoses) ? root.diagnoses : [];

  root.diagnoses = diagnoses.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return item;
    }

    const diagnosis = { ...(item as Record<string, unknown>) };
    diagnosis.issueType = normalizeEnum(diagnosis.issueType, reviewFailureIssueTypeSchema, issueTypeAliases, "unknown");
    diagnosis.narrativeLayer = normalizeEnum(diagnosis.narrativeLayer, narrativeLayerSchema, narrativeLayerAliases, "unknown");
    diagnosis.autoFixability = normalizeEnum(diagnosis.autoFixability, autoFixabilitySchema, autoFixabilityAliases, "unknown");
    diagnosis.affectedScope = normalizeAffectedScope(diagnosis.affectedScope);

    if (diagnosis.authorQuestion === null) {
      delete diagnosis.authorQuestion;
    }

    return diagnosis;
  });

  root.overallAutoFixability = normalizeEnum(root.overallAutoFixability, autoFixabilitySchema, autoFixabilityAliases, "unknown");

  return root;
}

export function parseReviewFailureDiagnosisWithNormalization(value: unknown): ReviewFailureDiagnosis {
  return reviewFailureDiagnosisSchema.parse(normalizeReviewFailureDiagnosisOutput(value));
}
