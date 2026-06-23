"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ projectId: string }>();

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <section className="mx-auto max-w-3xl rounded-3xl border border-red-900/60 bg-red-950/20 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-red-300">Workflow error</p>
        <h1 className="mt-3 text-3xl font-semibold">Something failed while running this project.</h1>
        <p className="mt-3 text-sm leading-6 text-red-100/80">
          {error.message || "The workflow failed. Check your model settings, API key, base URL, and project memory content."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={reset} className="rounded-2xl bg-red-300 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-red-200">
            Try again
          </button>
          <Link href={`/projects/${params.projectId}`} className="rounded-2xl border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-amber-300 hover:text-amber-200">
            Back to workspace
          </Link>
          <Link href="/settings" className="rounded-2xl border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-amber-300 hover:text-amber-200">
            Check settings
          </Link>
        </div>
      </section>
    </main>
  );
}
