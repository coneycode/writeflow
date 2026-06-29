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
        └── runs/
```

SQLite 存储元数据和文件引用。Markdown 与 JSON 文件存储人类可读的写作数据和生成 artifact。

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
- `status`：`draft`、`running`、`waiting`、`completed` 或 `failed`
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
- `selectFinalVariantForProject`：保存选定终稿。
- `runArchivistForProject`：从终稿分块摘要生成记忆补丁。
- `applyMemoryPatchForProject`：应用已批准的记忆补丁。

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
- Archivist 先使用 `finalDigestAgent` 对终稿分块摘要，再用摘要生成记忆补丁。
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

Editor 输出仍保存为每个变体的完整 `manuscript`，但内部由场景级润色结果合并而来。

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

## UI 架构

主工作台路由：

- `src/app/projects/[projectId]/page.tsx`

主要工作台组件：

- `WorkspaceShell`
- `MemorySidebar`
- `ManuscriptContextPanel`
- `MusePanel`
- `WorkflowGates`
- `ArchitectPanel`
- `OutlineWorkspace`
- `ScribePanel`
- `EditorPanel`
- `FinalSelectionPanel`
- `MemoryPatchPanel`
- `CriticPanel`
- `AgentSidebar`
- `GenerationProcessPanel`

页面加载项目数据、artifact 列表、上文上下文，并传入各个面板。当前 UI 是面板驱动，还不是状态机驱动。

`SubmitButton` 支持 `processHint`，在提交时通过浏览器 CustomEvent 通知 `GenerationProcessPanel` 展示当前生成阶段。

## 当前技术缺口

- `runs` 和 `run_steps` 还没有作为长生命周期工作流引擎使用。
- `gates` 已定义，但还没有完整持久化并驱动 UI 状态。
- Agent 执行同步发生在 server action 中；长时间模型调用后续可能需要 job handling 或 streaming。
- 生成过程面板展示的是阶段提示，不是服务端实时 streaming 事件。
- JSON 提取逻辑具备一定容错，但仍依赖模型遵守格式。
- 错误处理较基础，主要是服务端抛错。
- Provider 设置仍基于环境变量，还没有完整接入持久化 app settings。
- Critic review 还没有反馈到自动修订循环。
- `open_thread` 和 `close_thread` 在记忆补丁语义上还没有区别实现，目前都只是 append。

## 建议的下一步技术迭代

1. 基于 `runs`、`run_steps` 和 `gates` 为 `novel_continue` 引入工作流状态机。
2. 把 gate 决策变成一等记录，并从 active run 派生 UI 状态。
3. 为模型调用增加后台执行或 streaming。
4. 为失败步骤增加结构化错误记录和 retry 流程。
5. 把 provider 配置迁移到持久化 app settings，并保留环境变量兜底。
6. 实现 Critic findings 到 Editor 的修订循环。
7. 为记忆目标校验、artifact 持久化和 Agent JSON 解析增加测试。
