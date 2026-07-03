# Writeflow 技术方案

## 系统概览

Writeflow 是一个独立的本地优先 Next.js 应用。它使用 SQLite 存储元数据，并把长文项目内容保存为本地项目目录下的文件。Agent 在服务端执行，通过 OpenAI-compatible chat completion provider 调用模型。Agent 输出使用 Zod 校验，并持久化为 JSON artifact。

## 技术栈

- 框架：Next.js 16.2.9。
- UI：React 19.2.4。
- 语言：TypeScript 5。
- 样式：Tailwind CSS 4。
- 数据库：SQLite，通过 `better-sqlite3` 访问。
- ORM：Drizzle ORM 和 Drizzle Kit。
- 模型 provider：OpenAI SDK，对接 OpenAI-compatible endpoint。
- 校验：Zod。
- 图标和 UI 工具：`lucide-react`、`clsx`、`class-variance-authority`。

## 重要框架约束

本项目使用较新的 Next.js 版本，包含破坏性变化。修改框架敏感代码前，需要查阅本地 Next.js 文档：`node_modules/next/dist/docs/`。

Client Component 不直接导入 `src/app/actions.ts`。需要在 Server Component 中导入 server action，再作为 prop 传给 Client Component，避免把 `next/cache`、`fs`、数据库和 `better-sqlite3` 打进浏览器 bundle。

## 运行配置

Provider 设置从环境变量读取：

- `OPENAI_COMPATIBLE_API_KEY`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_MODEL`
- `OPENAI_COMPATIBLE_TIMEOUT_MS`
- `OPENAI_COMPATIBLE_MAX_RETRIES`

默认值：

- `OPENAI_COMPATIBLE_BASE_URL`：`https://api.openai.com/v1`
- `OPENAI_COMPATIBLE_MODEL`：`gpt-4.1`
- `OPENAI_COMPATIBLE_TIMEOUT_MS`：`900000`
- `OPENAI_COMPATIBLE_MAX_RETRIES`：`1`

项目数据位置：

- 默认数据根目录：`data/`
- 覆盖变量：`WRITEFLOW_DATA_DIR`

## 本地存储布局

默认存储布局：

```text
data/
├── writeflow.sqlite
└── projects/
    └── {projectId}/
        ├── memory/
        │   ├── canon/
        │   ├── progress/
        │   └── style/
        ├── manuscript/
        │   └── context.md
        ├── artifacts/
        ├── autopilot/
        │   └── current.json        # 自动续写批次状态（断点续跑）
        └── runs/
            └── {runId}/state.json   # 生成进度（落盘，供 SSE 与刷新恢复）
```

SQLite 存储元数据和文件引用。Markdown 与 JSON 文件存储人类可读的写作数据和生成 artifact。每个后台任务在 `runs/{runId}/state.json` 记录实时进度；自动续写批次进度存 `autopilot/current.json`。

## 数据库模型

### `projects`

存储项目元数据：

- `id`
- `name`
- `slug`
- `type`：`novel`、`story_edit` 或 `proposal`
- `description`
- `status`：`active` 或 `archived`
- `rootPath`
- 时间戳

### `runs`

存储工作流运行元数据：

- `id`
- `projectId`
- `workflow`
- `status`：`draft`、`running`、`waiting`、`completed`、`failed` 或 `cancelled`
- `currentStep`
- `summary`
- 时间戳

当前实现会把主要 server action 记录为 completed 或 failed run。schema 已经为更长生命周期的工作流状态机预留空间。

### `run_steps`

存储单个工作流步骤：

- `id`
- `runId`
- `agentId`
- `stepType`：`agent`、`gate` 或 `system`
- `title`
- `status`：`pending`、`running`、`waiting`、`completed` 或 `failed`
- `artifactId`
- 时间戳

### `artifacts`

存储生成 artifact 的元数据：

- `id`
- `projectId`
- `runId`
- `parentArtifactId`：上游 artifact id，用于按章节回溯谱系（direction→outline→draft→edit；review→被审对象；selected_final→edit）
- `kind`
- `title`
- `filePath`
- `createdAt`

Artifact 类型：

- `brief`
- `recall`
- `direction`
- `outline`
- `draft`
- `edit`
- `review`
- `selected_final`
- `memory_patch`
- `memory_patch_applied`（"已应用"审计记录，结构不同于 `memory_patch`，独立 kind 避免污染补丁列表）
- `chapter_plan`（自动续写的拆章规划，作为可见产物）
- `context_archive`（前情已归档进记忆的幂等标记）

`kind` 为 SQLite TEXT 列，新增枚举值无需迁移（`db:push` 报告 "No changes detected"）。读取 artifact 时可传入 Zod schema 做运行时校验，残缺产物返回 null，避免半成品渗进 UI 引发崩溃。

### `gates`

存储人工审批闸门：

- `id`
- `runId`
- `gateType`：`direction`、`outline`、`final` 或 `memory_patch`
- `status`：`waiting`、`approved`、`revision_requested` 或 `cancelled`
- `decision`
- 时间戳

该表已经存在，但还没有完整接入工作流执行。

### `app_settings`

应用级配置的 key-value 设置表。

## Server Actions

当前 server actions 提供主要应用行为：

- `createProject`：创建项目、本地目录和小说记忆模板。
- `updateProjectManuscriptContext`：保存上文上下文。
- `updateProjectMemoryFile`：更新允许范围内的记忆文件。
- `runMuseForProject`：基于上文和记忆生成续写方向。
- `runArchitectForProject`：从所选方向生成 beat sheet。
- `updateOutlineArtifact`：覆盖保存人工编辑后的大纲 artifact。
- `runScribeForProject`：从大纲按场景生成草稿变体。
- `updateDraftArtifact`：覆盖保存人工编辑后的分段草稿 artifact。
- `runEditorForProject`：按场景润色草稿变体。
- `runCriticForProject`：按变体和文本块审查草稿或编辑后变体。
- `reviseFromReviewForProject`：按审稿勾选的问题逐变体修订，产出新的 `edit` artifact（修订版）。
- `selectFinalVariantForProject`：保存选定终稿（按章节累计，写入 `chapters`，并生成该章概要 `summary`）。
- `updateFinalChapterForProject`：手动编辑某章正文/标题，落盘后重算概要并重同步该章记忆。
- `rewriteFinalChapterSpanForProject`：按偏移量圈选某章一段交 `spanRewriteAgent` 重写，原位替换后同 update 收尾。
- `removeFinalChapterForProject`：删除某章，重算全文与顶层字段。
- `runArchivistForProject`：从终稿分块摘要生成记忆补丁（注入前情，避免重复已成立事实）。
- `applyMemoryPatchForProject`：应用已批准的记忆补丁（写入 `memory_patch_applied` 审计记录）。
- `rebuildMemoryFromChaptersForProject`：一次性重建——清空各记忆文件的机器写入块（保留手写基底），前情归档后逐章按章归档。
- `getChapterArchive`：装配每章谱系（沿 `parentArtifactId` 回溯），供章节档案页只读展示。
- `runAutopilotForProject` / `runAutopilotFromPlanForProject` / `resumeAutopilotForProject`（及内部 `resumeAutopilotJob`）：多章自动续写编排、基于现有规划开写、断点续跑（详见下文「自动续写编排」）。
- `listChapterPlanArtifacts`：读取自动续写的章节规划产物，供入口面板展示。

### 后台任务与生成进度

模型驱动的动作（Muse / Architect / Scribe / Editor / Critic / Archivist / 修订）通过 `startJob` 以**后台任务**执行：建 run 行 + 进度文件后立即返回，executor 在 `AsyncLocalStorage` 上下文中 fire-and-forget 运行。

- 进度落盘：`src/core/run-progress.ts` 把每步的智能体、子步骤标签、模型逐字输出、起止时间写入 `data/projects/{id}/runs/{runId}/state.json`（防抖落盘 + 运行中心跳）。
- 流式：`OpenAICompatibleProvider` 在有进度上下文时使用 `stream: true`，逐 token 上报。
- 前端：`GET /api/projects/{id}/active-run` 用于刷新后重连；`GET /api/projects/{id}/runs/{runId}/stream`（SSE）实时推送进度，断连自动重连。
- 由于后台任务不能调用 `revalidatePath`，完成后由前端 `router.refresh()` 拉取新产物。
- stale 判定：running 超过阈值（5 分钟）且无心跳则视为中断。
- 中止：`RunProgress` 持有 `AbortController`，`/api/projects/{id}/runs/{runId}/cancel`（POST）触发 `requestCancel`，executor 在阶段边界检查 `isCancelled` 后优雅停下。

## 自动续写编排

`runAutopilotForProject` 是叠加在既有件之上的编排器，不重写各阶段逻辑，在单个 `startJob({ kind: "autopilot" })` 后台任务里顺序复用它们：

- 入参：`projectId`、`overallGoal`、`chapterCount`（1–10，常量 `AUTOPILOT_MAX_CHAPTERS`）、`perChapterBriefs`（多行文本，按行对应各章，可空）。
- 第一步调 `chapterPlannerAgent` 拆章 → `persistJobArtifact({ kind: "chapter_plan" })`，作为可见产物。
- `runChapterPipeline` 收拢单章流程：Muse 方向（自动采纳推荐）→ Architect 大纲 → Scribe A/B 变体（`runScribeVariant`）→ Editor 逐场润色（`runEditorSegment`）→ `autopilotReviewLoop` → `appendSelectedFinalChapter` 累计进全文 → `archiveChapterMemory`（只摘要本章、按章标记写入记忆并自动应用）。
- `autopilotReviewLoop`：逐候选 `runCriticVariant` 聚合 verdict；pass 即返回选中变体，否则 `reviseVariantManuscript` 按 issues 修订重审，最多 `AUTOPILOT_MAX_REVISIONS`（默认 2）轮；仍非 pass 返回 `{ ok: false, verdict, issues }`。
- 单章返回 `quality_failed`/`duplicate` 时编排器停止并抛出带报告的错误，run 标记失败、batch 记 `failure.kind`，**前面已成章已落盘保留**。
- 每章前检查 `currentProgress()?.isCancelled` 支持中止；artifact 通过 `parentArtifactId` 维持谱系，产出自然流入章节档案与全文展示。
- 产物谱系与终稿累计逻辑与手动流程一致（`finalChapters`、`combineManuscriptContext`、`latestFinalChapters`）。跨章规划已带全局编号；防重复以 `manuscriptSimilarity` 与最近若干已成章比对。

### 断点续跑与批次状态

`runAutopilotBatch(project, batch)` 是初次与续跑共用的执行主体。批次状态 `AutopilotBatch`（`src/core/autopilot-batch.ts`）落盘到 `autopilot/current.json`：

- 字段：`plan`（全局编号章节）、`priorChapterCountAtStart`、`status`、`autoRetryCount`、`failure{globalIndex,kind}`、`checkpoints`（每章各阶段已完成产物 ID）。
- 跳过已定稿章：`chapter.index <= latestFinalChapters().length` 则略过。
- 阶段复用：`runChapterPipeline` 接收 `checkpoint` 与 `onStage`，每阶段（方向/大纲/草稿/润色）前若已有产物 ID 则 `reloadArtifact` 读回复用，否则跑并回调 `saveChapterCheckpointStage` 记录；读回失败降级重跑该阶段（幂等，`archiveChapterMemory` 按 chapterId strip+rewrite 亦幂等）。
- 段级复用（更细粒度）：草稿/润色是"变体 × 多场景"的循环，每完成一场即经 `appendChapterSegment` 逐场落盘到 `checkpoint.draftSegments/editSegments`（按变体 id 分组）。续跑时 `runScribeVariant`/润色循环按 `sceneId` 跳过已完成的场，只补未完成的场——失败在变体 B 第 3 场时，变体 A 全部与 B 前 2 场都不重跑。整阶段落盘后 `clearChapterSegments` 清掉段级中间态（artifactId 已足够整段复用）。
- `runAutopilotForProject`：初次，拆章 → 建 batch → 跑。
- `runAutopilotFromPlanForProject`：读最新 `chapter_plan` 产物直接组装 batch 开跑，不重新拆章。
- `resumeAutopilotJob(projectId, auto)`：从 batch 续跑；`auto` 受 `AUTOPILOT_MAX_AUTO_RETRIES`（3）约束并自增计数，手动则重置计数；`quality`/`duplicate` 不允许自动续跑。经 `POST /api/projects/{id}/resume-autopilot?auto=1` 与 server action 两条入口调用。
- `GET /api/projects/{id}/resumable-autopilot`：返回 `{resumable, autoEligible, autoRetriesLeft, failure}`，供面板决定显示「继续」按钮与是否排程自动重试。

## Agent 执行架构

Agent 定义位于 registry。每个 Agent 包含：

- `id`
- `name`
- `role`
- `temperature`
- `systemPrompt`
- `outputSchema`

执行流程：

1. Server action 基于项目元数据、已选 artifact、上文上下文和 recall memory 构造 prompt。
2. `runAgent` 把 prompt 发送给 `OpenAICompatibleProvider`。
3. Provider 通过 OpenAI SDK 调用 chat completions。
4. 原始文本被归一化为 JSON object。
5. Agent 对应的 Zod schema 校验解析后的 JSON。
6. 结果被写入 JSON artifact。
7. 元数据写入 SQLite。
8. 相关 Next.js path 被 revalidate。

## 长文本与超时控制

当前实现避免把整章、全文或全部变体放进单次模型请求：

- Muse 和 Architect 只接收续写上文末尾与项目记忆摘录。
- Scribe 使用 `scribeSegmentAgent`，按 beat sheet 场景逐段生成正文。
- Editor 使用 `editorSegmentAgent`，按场景逐段润色正文。
- Critic 使用 `criticVariantAgent`，按变体与文本块审查，再聚合 verdict、summary 和 issues。
- Archivist 先使用 `finalDigestAgent` 对（单章）终稿分块摘要，再用摘要生成记忆补丁。
- `chapterSummaryAgent` 生成章节概要（供续写/拆章复用）；`spanRewriteAgent` 只重写圈选片段；`chapterPlannerAgent` 拆章。
- `tailText`、`excerptText`、`chunkText`、`manuscriptContextExcerpt` 和 `recallExcerpt` 控制 prompt 尺寸。

Provider 支持 `timeoutMs` 和 `maxRetries` 配置，并在失败时记录模型、maxTokens、prompt 字符数和超时设置。

## Artifact 持久化

生成的 artifact 会写入项目根目录：

```text
artifacts/{kind}/{timestamp}-{safe-title}.json
```

数据库保存 artifact 类型、标题和相对文件路径。读取 artifact 时，会从磁盘加载并解析 JSON 文件。

大纲和草稿支持原地覆盖编辑。覆盖写入通过 artifact 根目录校验，防止路径逃逸。

## Draft 与 Edit 数据形态

Scribe draft 使用场景对齐的分段结构：

- `variants[].segments[].sceneId`
- `variants[].segments[].sceneTitle`
- `variants[].segments[].manuscript`
- `variants[].segments[].notes`

Editor 输出仍保存为每个变体的完整 `manuscript`，但内部由场景级润色结果合并而来。审稿修订（`reviseFromReviewForProject`）同样产出 `edit` artifact，每个被修订变体存完整修订后 `manuscript`。

终稿（`selected_final`）按章节累计：除兼容字段外含 `chapters[]`（每章 id、来源、标题、正文、选择备注、`summary` 章节概要），`manuscript` 为各章拼接的完整全文。续写时以「原始上文 + 已选章节全文」作为承接上下文。手动编辑 / 圈选重写 / 删除章都走"读最新终稿 → 改 `chapters[]` → 重算全文 → 写新 `selected_final`"，下游（全文、续写上文、章节档案）从最新终稿派生，自动收敛。

## Recall 架构

小说 recall 当前读取：

- `memory/progress/state.md`
- `memory/progress/open_threads.md`
- `memory/canon/world.md`
- `memory/canon/timeline.md`
- `memory/style/voice.md`
- `memory/style/taboo.md`
- 所有 `memory/canon/characters/*.md` 文件

Recall builder 会把每个文件格式化成一个 section。进入模型 prompt 时会按阶段使用摘录，避免长项目记忆导致请求过大。

## 记忆补丁安全机制

记忆补丁应用限制在 allowlist 内：

- `memory/canon/world.md`
- `memory/canon/timeline.md`
- `memory/progress/state.md`
- `memory/progress/open_threads.md`
- `memory/style/voice.md`
- `memory/style/taboo.md`
- `memory/canon/characters/*.md`

补丁目标会被规范化，并解析到项目 memory 根目录下，防止路径穿越。

支持的操作：

- `append`
- `update`
- `open_thread`
- `close_thread`

`append`、`open_thread` 和 `close_thread` 当前都会追加补丁内容。`update` 会替换目标文件。

### 章节可追溯记忆块

累积型归属文件（`timeline.md`、`open_threads.md`、`world.md`、`characters/*.md`）中，每章贡献的内容用标记块包裹（`src/memory/chapter-blocks.ts`）：

```
<!-- wf:chapter <chapterId> start -->
<内容>
<!-- wf:chapter <chapterId> end -->
```

- `archiveChapterMemory` 只摘要单章正文（天然去重，取代旧的"摘要整份累计全文再 append"），写入前先 `stripChapterBlocks(chapterId)` 删旧块再 `wrapChapterBlock` 写新块 → 同一章重复归档只替换、不堆叠。
- `state.md`、`voice.md`、`taboo.md` 属"最新视角"的全局文件，仅在归档最新章（`includeGlobal`）时按原 append/update 更新，改中间章不回退。
- HTML 注释在 `MarkdownView` 渲染时不可见，不影响记忆页阅读。
- `ensureContextArchived`：首次归档时把前情（开篇上文）自动写入记忆并自动应用，`context_archive` 标记保证幂等。
- `rebuildMemoryFromChaptersForProject` 用 `stripAllMachineBlocks` 清掉从第一个机器标记（旧 `<!-- Writeflow memory patch:` 或新 `<!-- wf:chapter`）起的所有内容、保留手写基底，再逐章重建——修复历史遗留的重复/无标记 timeline。

## UI 架构

主工作台路由：

- `src/app/projects/[projectId]/page.tsx`

UI 采用三栏写作 IDE 布局，由 Client 外壳 `WorkspaceLayout` 管理当前聚焦阶段，各阶段面板作为 RSC slot 注入（面板仍是 Server Component，server action 经 props 传入，避免把 `fs`/数据库打进浏览器 bundle）。

主要组件：

- `WorkspaceShell`：外层壳与顶部导航（工作台 / 章节档案 / 记忆 / 运行记录 / 设置）。
- `WorkspaceLayout` / `StageRail` / `ContextRail`：三栏布局、左栏阶段管线、右栏上下文。
- `workspace-stage.ts`：`deriveStages` 按产物存在性派生阶段状态。
- 阶段面板：`ManuscriptContextPanel`、`MusePanel`、`ArchitectPanel` + `OutlineWorkspace`、`ScribePanel` + `DraftWorkspace`、`EditorPanel`、`CriticPanel`、`FinalSelectionPanel`、`MemoryPatchPanel`。
- `GenerationProcessPanel`：右栏常驻，SSE 实时进度；autopilot 失败/中断时显示「继续」按钮并按 `resumable-autopilot` 排程自动重试（计数由服务端 batch 持久，刷新不清零）。
- `CollapsibleProse`：长正文折叠/展开，展开也有最大高度、内部滚动。
- `FinalChapterReader`：终稿阅读区（client），章节列表点选后只显示该章正文；编辑态支持改标题/正文、圈选重写、删除（server action 经 prop 传入）。
- `MemoryFileCard` + `MarkdownView`：记忆页按 Markdown 渲染阅读、点「编辑」进文本框。
- `ChapterArchiveView`（`/projects/{id}/chapters`）：按章只读回看。
- `AutopilotPanel`：工作台顶部可折叠入口，整体目标 / 章数 / 逐章要点表单，并展示最新 `chapter_plan` 规划卡片 +「基于此规划开写」（server action 经 prop 传入）。

阶段的当前聚焦项持久化到 `sessionStorage`，刷新后停留原处。

阶段状态由已加载的 artifact 派生：每个阶段 done（有产物）/ current（第一个未完成且前置满足）/ locked（前置未满足或上文未填）。

`SubmitButton` 在提交时派发浏览器事件，`GenerationProcessPanel` 据此查 `active-run` 并连 SSE 展示实时进度。

## 当前技术缺口

- `runs` / `run_steps` 已用于记录与进度，但还没有作为长生命周期工作流状态机驱动 UI。
- `gates` 已定义，UI 仍以「按产物派生」呈现闸门，未作为一等记录持久化驱动。
- JSON 提取逻辑具备一定容错（含枚举别名归一化），但仍依赖模型大体遵守格式。
- Provider 设置仍基于环境变量，还没有完整接入持久化 app settings。
- 手动流程的修订循环仍为手动触发、手动重审；自动「修订→重审」迭代目前只在 Autopilot 路径内（固定最大轮数）。
- 单变体正文极长时，修订为单次大调用，仍有真实 API 超时风险（由超时配置兜底）。
- 自动续写为很长的单个后台任务（可能数十分钟），依赖心跳 + 轮询兜底 + 中止；已支持失败/中断后从 `autopilot/current.json` 断点续跑（跳过已定稿章、复用已完成阶段），但进程被杀后仍需重新进入页面触发续跑，无常驻守护自动拉起。
- 自动续写连跑期间记忆补丁自动写回，存在 canon 被自动改写的风险（保留 applied 记录可追溯）。
- `open_thread` 和 `close_thread` 在记忆补丁语义上还没有区别实现，目前都只是 append。
- 旧 artifact 无父链，章节档案中只能显示终稿，上游阶段缺失（不做回填）。

## 建议的下一步技术迭代

1. 基于 `runs`、`run_steps` 和 `gates` 为 `novel_continue` 引入工作流状态机。
2. 把 gate 决策变成一等记录，并从 active run 派生 UI 状态。
3. 为修订循环增加「修订→重审」自动迭代与收敛判定。
4. 为失败步骤增加结构化错误记录和 retry 流程。
5. 把 provider 配置迁移到持久化 app settings，并保留环境变量兜底。
6. 部署到 serverless 时，把后台任务替换为可靠的任务队列（当前依赖长驻 Node 进程）。
7. 为记忆目标校验、artifact 持久化和 Agent JSON 解析增加测试。
