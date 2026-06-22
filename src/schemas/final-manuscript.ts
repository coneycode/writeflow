import { z } from "zod";

export const finalManuscriptSchema = z.object({
  sourceArtifactId: z.string(),
  sourceVariantId: z.string(),
  title: z.string(),
  manuscript: z.string(),
  selectionNote: z.string(),
});

export type FinalManuscript = z.infer<typeof finalManuscriptSchema>;
