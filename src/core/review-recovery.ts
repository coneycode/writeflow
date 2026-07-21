import { createHash } from "node:crypto";

import type { ReviewIssue } from "@/schemas/review";
import type { ReviewFailureDiagnosis, TargetedRepairPlan } from "@/schemas/review-repair";
import type { IssueFingerprint, ReviewRecoveryTrace } from "@/schemas/review-recovery";

export const AUTOPILOT_MAX_TARGETED_REPAIR_ATTEMPTS = 3;
export const AUTOPILOT_MAX_NO_PROGRESS_REPAIR_ATTEMPTS = 2;

const issueTypeHints: Array<[RegExp, string]> = [
  [/连续性|前后不一|矛盾|物件|道具|一致|状态/, "continuity_conflict"],
  [/因果|为什么|缺少理由|无法解释|不成立|突兀|合理性/, "causality_gap"],
  [/动机|人物为什么|行为逻辑|心理依据/, "character_motivation_gap"],
  [/时间|先后|同时|之前|之后/, "timeline_conflict"],
  [/空间|位置|地点|距离|方位/, "spatial_logic_conflict"],
  [/设定|世界观|规则|能力|制度/, "worldbuilding_conflict"],
  [/语气|文风|措辞|腔调|风格/, "tone_mismatch"],
  [/节奏|拖沓|过快|压缩|铺陈/, "pacing_problem"],
  [/信息|读者不明白|困惑|不清楚|交代/, "information_flow_problem"],
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}]+/gu, "").slice(0, 120);
}

function inferIssueType(issue: ReviewIssue) {
  const text = `${issue.problem}\n${issue.evidence}\n${issue.suggestedFix}`;
  return issueTypeHints.find(([pattern]) => pattern.test(text))?.[1] ?? "unknown";
}

function hashParts(parts: string[]) {
  return createHash("sha1").update(parts.join("|"), "utf8").digest("hex").slice(0, 16);
}

export function fingerprintReviewIssues(issues: ReviewIssue[], diagnosis?: ReviewFailureDiagnosis): IssueFingerprint[] {
  return issues.map((issue, index) => {
    const diagnosed = diagnosis?.diagnoses.find((item) => item.sourceIssueIndex === index);
    const affectedScope = diagnosed
      ? [
          ...diagnosed.affectedScope.scenes,
          ...diagnosed.affectedScope.paragraphs,
          ...diagnosed.affectedScope.characters,
          ...diagnosed.affectedScope.facts,
        ].map(normalizeText).filter(Boolean)
      : [issue.location, issue.variantId].filter((item): item is string => Boolean(item)).map(normalizeText);
    const issueType = diagnosed?.issueType ?? inferIssueType(issue);
    const narrativeLayer = diagnosed?.narrativeLayer ?? "unknown";
    const normalizedProblem = normalizeText(`${issue.problem} ${issue.evidence}`);
    return {
      hash: hashParts([issue.severity, issue.variantId ?? "all", issueType, narrativeLayer, normalizedProblem, affectedScope.join(",")]),
      severity: issue.severity,
      issueType,
      narrativeLayer,
      variantId: issue.variantId,
      normalizedProblem,
      affectedScope,
    };
  });
}

function severityWeight(severity: ReviewIssue["severity"]) {
  return severity === "blocker" ? 3 : severity === "major" ? 2 : 1;
}

export function issueBurden(issues: ReviewIssue[]) {
  return issues.reduce((sum, issue) => sum + severityWeight(issue.severity), 0);
}

export function fingerprintSetKey(fingerprints: IssueFingerprint[]) {
  return fingerprints.map((fingerprint) => fingerprint.hash).sort().join(":");
}

export function hasRecoveryProgress(previous: ReviewIssue[], next: ReviewIssue[], previousKey: string, nextKey: string) {
  if (issueBurden(next) < issueBurden(previous)) {
    return true;
  }
  if (next.length < previous.length) {
    return true;
  }
  return previousKey !== nextKey && issueBurden(next) <= issueBurden(previous);
}

export function diagnosisAllowsRecovery(diagnosis: ReviewFailureDiagnosis) {
  return diagnosis.overallAutoFixability === "safe_auto_fix" || diagnosis.overallAutoFixability === "likely_auto_fix";
}

export function diagnosisNeedsAuthor(diagnosis: ReviewFailureDiagnosis) {
  return diagnosis.overallAutoFixability === "needs_author_choice" || diagnosis.diagnoses.some((item) => item.autoFixability === "needs_author_choice");
}

export function shouldContinueRecovery(input: {
  trace: ReviewRecoveryTrace;
  diagnosis: ReviewFailureDiagnosis;
  currentAttempt: number;
  noProgressCount: number;
}) {
  if (diagnosisNeedsAuthor(input.diagnosis)) {
    return false;
  }
  if (!diagnosisAllowsRecovery(input.diagnosis)) {
    return false;
  }
  if (input.currentAttempt >= input.trace.maxAttempts) {
    return false;
  }
  return input.noProgressCount < AUTOPILOT_MAX_NO_PROGRESS_REPAIR_ATTEMPTS;
}

export function repairLevelRank(level: TargetedRepairPlan["repairLevel"]) {
  const ranks: Record<TargetedRepairPlan["repairLevel"], number> = {
    paragraph: 1,
    scene: 2,
    multi_scene: 3,
    outline: 4,
    chapter_strategy: 5,
    memory: 4,
    final_selection: 4,
    author_choice: 99,
    system_attention: 99,
  };
  return ranks[level];
}
