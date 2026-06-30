import { readRunState } from "@/core/run-progress";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 300;
const MAX_DURATION_MS = 20 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; runId: string }> }) {
  const { projectId, runId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastSnapshot = "";
      let closed = false;

      const send = (state: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
      };

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      while (!closed) {
        const state = await readRunState(projectId, runId);

        if (!state) {
          send({ status: "missing", runId });
          close();
          break;
        }

        // 仅在内容变化时推送，降低无效流量。
        const snapshot = JSON.stringify(state);
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot;
          send(state);
        }

        if (state.status !== "running") {
          close();
          break;
        }

        if (Date.now() - startedAt > MAX_DURATION_MS) {
          close();
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
