import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import { readBatch } from "@/core/autopilot-batch";
import { projectRoot } from "@/lib/paths";

export type RunKind = "muse" | "architect" | "scribe" | "editor" | "critic" | "final" | "archivist" | "autopilot";

export type RunStepStatus = "running" | "completed" | "failed";
export type RunStatus = "running" | "completed" | "failed" | "interrupted" | "cancelled";

export type RunStep = {
  id: string;
  agent: string;
  label: string;
  status: RunStepStatus;
  promptPreview: string;
  output: string;
  startedAt: string;
  endedAt?: string;
};

export type RunState = {
  runId: string;
  projectId: string;
  kind: RunKind;
  title: string;
  status: RunStatus;
  startedAt: string;
  updatedAt: string;
  error?: string;
  steps: RunStep[];
};

/** 超过此时间没有心跳的 running 状态，视为进程中断。
 *  单次长调用（如架构师生成完整大纲）可能耗时 2-3 分钟，阈值需放宽，
 *  同时配合运行中 step 的周期心跳，避免把仍在正常运行的任务误判为中断。 */
const STALE_AFTER_MS = 5 * 60 * 1000;
/** 运行中 step 的心跳间隔：即便没有 token 流入也定期刷新 updatedAt。 */
const HEARTBEAT_INTERVAL_MS = 15 * 1000;
/** token 落盘防抖间隔。 */
const FLUSH_INTERVAL_MS = 250;
const PROMPT_PREVIEW_LIMIT = 1200;

function runsDir(projectId: string) {
  return path.join(projectRoot(projectId), "runs");
}

function runStatePath(projectId: string, runId: string) {
  return path.join(runsDir(projectId), runId, "state.json");
}

/**
 * 单次 run 的进度上下文。通过 AsyncLocalStorage 注入，
 * provider 与深层循环无需改签名即可上报进度 / 流式 token。
 */
export class RunProgress {
  private state: RunState;
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private controller = new AbortController();
  private cancelled = false;

  constructor(state: RunState) {
    this.state = state;
  }

  /** 传给模型请求的取消信号；中止时 abort，使进行中的流式请求立即抛错。 */
  get signal() {
    return this.controller.signal;
  }

  get isCancelled() {
    return this.cancelled;
  }

  /** 请求中止：置标志并 abort 信号。executor 会在下一次 runAgent 前或流式循环中感知。 */
  cancel() {
    if (this.cancelled) {
      return;
    }
    this.cancelled = true;
    this.controller.abort();
  }

  /** 运行中定期刷新 updatedAt 并落盘，作为心跳，避免长调用被误判为中断。 */
  private startHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      this.touch();
      void this.flushNow();
    }, HEARTBEAT_INTERVAL_MS);
    // 心跳不应阻止进程退出。
    this.heartbeatTimer.unref?.();
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  get runId() {
    return this.state.runId;
  }

  private touch() {
    this.state.updatedAt = new Date().toISOString();
    // 任何状态变更都标记 dirty，确保后续 flushNow 一定写盘。
    // （否则 endStep 清零 dirty 后，fail()/complete() 的写盘会被跳过，
    //  导致失败状态与错误信息永远落不了盘，UI 只能显示“已中断”。）
    this.dirty = true;
  }

  /** 防抖落盘：标记 dirty，到间隔再 flush；步骤边界用 flushNow 立即写。 */
  private scheduleFlush() {
    this.dirty = true;
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushNow();
    }, FLUSH_INTERVAL_MS);
  }

  async flushNow() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.dirty) {
      return this.writeChain;
    }
    this.dirty = false;
    const snapshot = JSON.stringify(this.state, null, 2);
    const target = runStatePath(this.state.projectId, this.state.runId);
    this.writeChain = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, snapshot, "utf8");
    });
    return this.writeChain;
  }

  startStep(input: { agent: string; label: string; promptPreview: string }) {
    const step: RunStep = {
      id: randomUUID(),
      agent: input.agent,
      label: input.label,
      status: "running",
      promptPreview: input.promptPreview.slice(0, PROMPT_PREVIEW_LIMIT),
      output: "",
      startedAt: new Date().toISOString(),
    };
    this.state.steps.push(step);
    this.touch();
    void this.flushNow();
    this.startHeartbeat();
    return step.id;
  }

  appendToken(stepId: string, token: string) {
    const step = this.state.steps.find((item) => item.id === stepId);
    if (!step) {
      return;
    }
    step.output += token;
    this.touch();
    this.scheduleFlush();
  }

  endStep(stepId: string, status: Extract<RunStepStatus, "completed" | "failed"> = "completed") {
    const step = this.state.steps.find((item) => item.id === stepId);
    if (step) {
      step.status = status;
      step.endedAt = new Date().toISOString();
    }
    // 没有仍在运行的 step 时停掉心跳；多步任务会在下一个 startStep 重启。
    if (!this.state.steps.some((item) => item.status === "running")) {
      this.stopHeartbeat();
    }
    this.touch();
    void this.flushNow();
  }

  /** 当前正在运行的步骤（最后一个 running）。供 provider 在无显式 stepId 时回退。 */
  currentStepId() {
    for (let index = this.state.steps.length - 1; index >= 0; index -= 1) {
      if (this.state.steps[index].status === "running") {
        return this.state.steps[index].id;
      }
    }
    return null;
  }

  async complete() {
    this.stopHeartbeat();
    this.state.status = "completed";
    this.touch();
    await this.flushNow();
    await updateRunRow(this.state.runId, "completed", this.state.steps.at(-1)?.label ?? this.state.title);
  }

  async fail(error: string) {
    this.stopHeartbeat();
    this.state.status = "failed";
    this.state.error = error;
    const running = this.state.steps.find((item) => item.status === "running");
    if (running) {
      running.status = "failed";
      running.endedAt = new Date().toISOString();
    }
    this.touch();
    await this.flushNow();
    await updateRunRow(this.state.runId, "failed", error.slice(0, 160));
  }

  async markCancelled() {
    this.stopHeartbeat();
    this.state.status = "cancelled";
    this.state.error = "已被用户中止。";
    const running = this.state.steps.find((item) => item.status === "running");
    if (running) {
      running.status = "failed";
      running.endedAt = new Date().toISOString();
    }
    this.touch();
    await this.flushNow();
    await updateRunRow(this.state.runId, "cancelled", "已被用户中止");
  }
}

// 活跃 run 注册表：按 runId 持有 RunProgress，供取消 API 查找并请求中止。
//
// 必须挂在 globalThis 上：Next.js App Router 把 Server Action（startJob 经此注册）
// 与 Route Handler（/cancel 经此查找）编译进不同的模块图，模块级 `const` 在两图中
// 各自独立。若用普通模块级 Map，cancel 路由查到的是空 Map → requestCancel 永远返回
// false → 中止信号发不出去，任务停不下来。globalThis 在同一 Node 进程内跨图共享，
// 保证两侧引用同一个注册表与同一个 RunProgress 实例。
const globalRegistry = globalThis as typeof globalThis & {
  __writeflowActiveRuns?: Map<string, RunProgress>;
};
const activeRuns: Map<string, RunProgress> =
  globalRegistry.__writeflowActiveRuns ?? (globalRegistry.__writeflowActiveRuns = new Map());

/** 请求中止指定 run。返回是否找到活跃任务。 */
export function requestCancel(runId: string): boolean {
  const progress = activeRuns.get(runId);
  if (!progress) {
    return false;
  }
  progress.cancel();
  return true;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "APIUserAbortError");
}

const storage = new AsyncLocalStorage<RunProgress>();

/** provider / runAgent 用它拿到当前 run 的进度上下文（可能为空）。 */
export function currentProgress(): RunProgress | undefined {
  return storage.getStore();
}

async function updateRunRow(runId: string, status: "completed" | "failed" | "cancelled", summary: string) {
  await db
    .update(schema.runs)
    .set({ status, summary, updatedAt: new Date() })
    .where(eq(schema.runs.id, runId));
}

async function createRun(input: { projectId: string; kind: RunKind; title: string }) {
  const now = new Date();
  const runId = randomUUID();

  await db.insert(schema.runs).values({
    id: runId,
    projectId: input.projectId,
    workflow: "novel_continue",
    status: "running",
    currentStep: input.kind,
    summary: input.title,
    createdAt: now,
    updatedAt: now,
  });

  const state: RunState = {
    runId,
    projectId: input.projectId,
    kind: input.kind,
    title: input.title,
    status: "running",
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    steps: [],
  };

  const target = runStatePath(input.projectId, runId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(state, null, 2), "utf8");

  return new RunProgress(state);
}

/**
 * 在后台执行一个生成任务：建 run 行 + state.json，立即返回 runId，
 * executor 在 AsyncLocalStorage 上下文中 fire-and-forget 执行。
 */
export async function startJob(input: {
  projectId: string;
  kind: RunKind;
  title: string;
  executor: () => Promise<void>;
}) {
  const progress = await createRun({ projectId: input.projectId, kind: input.kind, title: input.title });
  activeRuns.set(progress.runId, progress);

  const settle = async (error?: unknown) => {
    activeRuns.delete(progress.runId);
    if (progress.isCancelled || isAbortError(error)) {
      await progress.markCancelled();
      return;
    }
    if (error !== undefined) {
      await progress.fail(error instanceof Error ? error.message : String(error));
      return;
    }
    await progress.complete();
  };

  void storage
    .run(progress, async () => {
      try {
        await input.executor();
        await settle();
      } catch (error) {
        await settle(error);
      }
    })
    .catch(async (error) => {
      await settle(error);
    });

  return { runId: progress.runId };
}

export async function readRunState(projectId: string, runId: string): Promise<RunState | null> {
  try {
    const content = await fs.readFile(runStatePath(projectId, runId), "utf8");
    const state = JSON.parse(content) as RunState;
    if (state.status === "running") {
      const age = Date.now() - new Date(state.updatedAt).getTime();
      if (age > STALE_AFTER_MS) {
        return { ...state, status: "interrupted" };
      }
    }
    return state;
  } catch {
    return null;
  }
}

/** 查询当前项目最近的、仍在运行（且未 stale）的 run，用于刷新后重连。 */
export async function findActiveRun(projectId: string): Promise<RunState | null> {
  const rows = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.projectId, projectId))
    .orderBy(desc(schema.runs.createdAt))
    .limit(5);

  for (const row of rows) {
    if (row.status !== "running") {
      continue;
    }
    const state = await readRunState(projectId, row.id);
    if (state && state.status === "running") {
      return state;
    }
  }

  return null;
}

/**
 * 查询工作台应展示的 run：优先返回正在运行的 run；若没有运行中任务，
 * 返回最近一个可续跑/需审阅的 autopilot 终态 run，避免刷新后“生成过程”消失。
 */
export async function findVisibleRun(projectId: string): Promise<RunState | null> {
  const active = await findActiveRun(projectId);
  if (active) {
    return active;
  }

  const batch = await readBatch(projectId);
  const isPausedWithFailure = batch?.status === "cancelled" && Boolean(batch.failure);
  if (!batch || (batch.status !== "failed" && batch.status !== "gated" && !isPausedWithFailure)) {
    return null;
  }

  const rows = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.projectId, projectId))
    .orderBy(desc(schema.runs.createdAt))
    .limit(10);

  for (const row of rows) {
    if (row.currentStep !== "autopilot" || row.status === "running") {
      continue;
    }
    const state = await readRunState(projectId, row.id);
    if (state?.kind === "autopilot") {
      return state;
    }
  }

  return null;
}
