import { z } from "zod";

export const spanRewriteSchema = z.object({
  rewritten: z.string(),
});

export type SpanRewrite = z.infer<typeof spanRewriteSchema>;
