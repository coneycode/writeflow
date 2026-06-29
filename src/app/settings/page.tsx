import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-stone-950 px-6 py-8 text-stone-100">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-stone-500 transition hover:text-amber-200">
          返回项目列表
        </Link>
        <section className="mt-6 rounded-3xl border border-stone-800 bg-stone-900/70 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">应用设置</p>
          <h1 className="mt-3 text-3xl font-semibold">模型提供方</h1>
          <p className="mt-3 max-w-2xl text-stone-400">
            模型已通过 OpenAI 兼容接口接入。可参考 `.env.example` 在 `.env.local` 中配置。
          </p>

          <div className="mt-8 grid gap-4">
            {[
              ["服务地址", "OPENAI_COMPATIBLE_BASE_URL"],
              ["接口密钥", "OPENAI_COMPATIBLE_API_KEY"],
              ["默认模型", "OPENAI_COMPATIBLE_MODEL"],
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
