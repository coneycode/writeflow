import type {
  getProject,
  listChapterPlanArtifacts,
  listDirectionArtifacts,
  listDraftArtifacts,
  listFinalArtifacts,
  listMemoryPatchArtifacts,
  listOutlineArtifacts,
  listReviewArtifacts,
  listSelectedFinalArtifacts,
  listVariantStrategyArtifacts,
} from "@/app/actions";

export type ProjectView = NonNullable<Awaited<ReturnType<typeof getProject>>>;
export type DirectionArtifacts = Awaited<ReturnType<typeof listDirectionArtifacts>>;
export type OutlineArtifacts = Awaited<ReturnType<typeof listOutlineArtifacts>>;
export type VariantStrategyArtifacts = Awaited<ReturnType<typeof listVariantStrategyArtifacts>>;
export type DraftArtifacts = Awaited<ReturnType<typeof listDraftArtifacts>>;
export type FinalArtifacts = Awaited<ReturnType<typeof listFinalArtifacts>>;
export type ReviewArtifacts = Awaited<ReturnType<typeof listReviewArtifacts>>;
export type SelectedFinalArtifacts = Awaited<ReturnType<typeof listSelectedFinalArtifacts>>;
export type MemoryPatchArtifacts = Awaited<ReturnType<typeof listMemoryPatchArtifacts>>;
export type ChapterPlanArtifacts = Awaited<ReturnType<typeof listChapterPlanArtifacts>>;
