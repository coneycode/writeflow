# Writeflow

Writeflow 是一个本地优先、human-in-the-loop 的多 Agent 长文写作工作台，当前聚焦小说续写。它不是“一键生成器”，而是把上文、项目记忆、结构化 Agent 分工、人工闸门和可审计 artifact 串成一个可控写作流程。

## 当前能力

- 本地 Next.js 应用，使用 SQLite 保存元数据，项目正文、记忆和产物保存在本地文件目录。
- 小说项目初始化后自动生成 Markdown 记忆模板，便于作者持续维护 canon、时间线、人物、风格和开放线索。
- “续写上文”是生成链路的硬依赖，Muse、Architect、Scribe、Editor、Critic 都会基于上文承接。
- Muse 生成续写方向，Architect 生成章节大纲，Scribe 按大纲场景生成正文，Editor 按场景润色，Critic 分块审稿，Archivist 提出记忆补丁。
- 大纲默认只读，可进入编辑模式直接调整；正文草稿按大纲场景分段展示和编辑。
- 工作台只展示每个阶段的最新产物，历史产物仍保留在 artifact 记录中。
- 生成过程中会显示悬浮过程面板，让用户看到当前 Agent、阶段说明和执行耗时。
- 模型调用已拆分为场景级或文本块级，降低长篇正文生成、润色、审稿和归档时的超时风险。

## 技术栈

- Next.js `16.2.9`
- React `19.2.4`
- TypeScript
- Tailwind CSS v4
- SQLite + `better-sqlite3`
- Drizzle ORM / Drizzle Kit
- OpenAI SDK，对接 OpenAI-compatible chat completions endpoint
- Zod 输出校验

## 本地运行

安装依赖并初始化数据库：

```bash
npm install
npm run db:push
```

复制环境变量模板：

```bash
cp .env.example .env.local
```

配置 `.env.local`：

```env
OPENAI_COMPATIBLE_API_KEY=
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
OPENAI_COMPATIBLE_MODEL=gpt-4.1
OPENAI_COMPATIBLE_TIMEOUT_MS=900000
OPENAI_COMPATIBLE_MAX_RETRIES=1
WRITEFLOW_DATA_DIR=./data
```

启动开发服务器：

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 项目数据

默认数据目录是 `data/`，也可以通过 `WRITEFLOW_DATA_DIR` 覆盖。

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

`data/`、`.env*`、`.next/`、`.omc/` 等本地运行产物不会提交到 Git。

## 工作流

1. 创建小说项目。
2. 编辑项目记忆和“续写上文”。
3. Muse 生成多个续写方向。
4. 用户选择方向。
5. Architect 生成章节大纲。
6. 用户阅读或编辑大纲。
7. Scribe 按场景生成两个正文变体。
8. Editor 按场景润色正文。
9. Critic 按变体和文本块审稿。
10. 用户选择终稿。
11. Archivist 基于终稿分块摘要提出记忆补丁。
12. 用户审批并应用记忆补丁。

## 文档

- `docs/product-plan.md`：产品定位、用户、工作流、Agent 职责和迭代方向。
- `docs/technical-plan.md`：技术架构、数据模型、Server Actions、Agent 执行、存储和风险点。

## 常用命令

```bash
npm run lint
npm run build
npm run db:push
```
