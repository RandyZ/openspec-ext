/**
 * Types and interface for Agent executor adapters (Cursor, Claude Code, Clipboard, etc.).
 * Main logic and adapters MUST depend only on this file; no direct imports of concrete adapter implementations in main code.
 */

/** 执行请求（主逻辑 → Adapter） */
export interface TaskExecuteRequest {
  changeName: string;
  taskIndex: number;
  taskText: string;
  /** 相对路径，如 ['openspec/changes/foo/design.md', 'tasks.md'] */
  contextFiles: string[];
  workspaceRoot: string;
  /**
   * 已按 OpenSpec 工作流/opsx 命令格式化好的 prompt。
   * 若存在，adapter 必须用其调用 agent，不再自行拼文案。
   */
  promptOverride?: string;
}

/** 执行结果（Adapter → 主逻辑） */
export interface TaskExecuteResult {
  success: boolean;
  message?: string;
  adapterId: string;
}

/** Agent 执行器适配器接口，所有具体 Adapter 实现此接口 */
export interface IAgentExecutorAdapter {
  readonly id: string;
  readonly displayName: string;

  /** 当前环境是否可用（如 CLI 存在、API 可用） */
  isAvailable(): Promise<boolean>;

  /** 自动执行：直接执行任务，不打开 Chat */
  executeTask(request: TaskExecuteRequest): Promise<TaskExecuteResult>;

  /** 填入 Chat：打开 Chat 并预填，或复制到剪贴板兜底 */
  fillChat(request: TaskExecuteRequest): Promise<TaskExecuteResult>;
}
