# Writeflow

Writeflow 是一个本地优先、human-in-the-loop 的多 Agent 长文写作工作台，当前聚焦小说续写。它不是“一键生成器”，而是把上文、项目记忆、结构化 Agent 分工、人工闸门和可审计 artifact 串成一个可控写作流程。

## 当前能力

- 本地 Next.js 应用，使用 SQLite 保存元数据，项目正文、记忆和产物保存在本地文件目录。
- 小说项目初始化后自动生成 Markdown 记忆模板，便于作者持续维护 canon、时间线、人物、风格和开放线索。
- “续写上文”是生成链路的硬依赖；续写时会自动拼接「原始上文 + 已选章节全文」作为完整上下文，Muse、Architect、Scribe、Editor、Critic、Archivist 都基于它承接。
- Muse 生成续写方向（保存构思说明），Architect 生成章节大纲，Scribe 按大纲场景生成正文，Editor 按场景润色，Critic 分块审稿，Archivist 提出记忆补丁。
- 三栏写作工作台：左栏工作流阶段管线（按产物派生真实状态/当前步/锁定），中栏浅色文档区只聚焦当前阶段，右栏为续写上文、记忆文件入口、已写全文与生成过程。
- 大纲与分段草稿默认只读、点按钮进入编辑模式；长正文支持折叠/展开阅读。
- 终稿按章节累计，可查看完整全文并「继续写下一章」（自动承接全文上下文）。
- 章节档案页按章回看每一章的方向 / 大纲 / 分段草稿 / 润色稿 / 审稿 / 终稿（artifact 以父链记录谱系）。
- 审稿修复闭环：在审稿面板勾选问题，一键交给编辑智能体修订，生成新的润色版本。
- 生成过程持久化 + 逐字流式：进度落盘并通过 SSE 实时展示当前智能体、子步骤、模型逐字输出与耗时，刷新页面不丢失、断连自动重连。
- 模型调用按场景级或文本块级拆分，配合心跳与超时阈值，降低长篇生成、润色、审稿、归档的超时与误判风险。

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
10. （可选）勾选审稿问题，交编辑智能体修订，生成新的润色版本，再次审稿确认。
11. 用户选择终稿，累计进入全文。
12. Archivist 基于终稿分块摘要提出记忆补丁，用户审批并应用。
13. 点「继续写下一章」回到构思，自动承接全文继续下一章。

可在工作台顶部「章节档案」按章回看每一章的完整创作过程。

## 文档

- `docs/product-plan.md`：产品定位、用户、工作流、Agent 职责和迭代方向。
- `docs/technical-plan.md`：技术架构、数据模型、Server Actions、Agent 执行、存储和风险点。

## 常用命令

```bash
npm run lint
npm run build
npm run db:push
```
