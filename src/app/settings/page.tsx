import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-stone-500 transition hover:text-amber-200">
          Back to projects
        </Link>
        <section className="mt-6 rounded-3xl border border-stone-800 bg-stone-900/70 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">App settings</p>
          <h1 className="mt-3 text-3xl font-semibold">Model provider</h1>
          <p className="mt-3 max-w-2xl text-stone-400">
            Milestone 2 will connect an OpenAI-compatible provider. For now, configure values in `.env.local` using `.env.example` as the template.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              ["Base URL", "OPENAI_COMPATIBLE_BASE_URL"],
              ["API key", "OPENAI_COMPATIBLE_API_KEY"],
              ["Default model", "OPENAI_COMPATIBLE_MODEL"],
            ].map(([label, envKey]) => (
              <div key={envKey} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                <p className="text-sm text-stone-300">{label}</p>
                <p className="mt-2 font-mono text-xs text-stone-500">{envKey}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
