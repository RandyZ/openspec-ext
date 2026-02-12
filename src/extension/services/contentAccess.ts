/**
 * Content Access 层：读/写 artifact、任务、delta spec、归档列表等。
 * 当前默认实现基于 openspec/ 目录；接口抽象便于将来由 CLI 或其它实现替换。
 */
import type { ArchivedChangeInfo, SpecInfo } from './types';

/** 与 fileManager.Task 一致，用于接口返回类型 */
export interface Task {
  lineIndex: number;
  indent: number;
  done: boolean;
  text: string;
  originalLine: string;
}

export interface IOpenSpecContentAccess {
  readArtifact(changeName: string, artifactType: string): Promise<string>;
  artifactExists(changeName: string, artifactType: string): Promise<boolean>;
  readTasks(changeName: string): Promise<Task[]>;
  getDirectChildIndices(tasks: Task[], taskIndex: number): number[];
  toggleTask(changeName: string, taskIndex: number): Promise<void>;
  autoCompleteParents(changeName: string): Promise<void>;
  listDeltaSpecIds(changeName: string): Promise<string[]>;
  readDeltaSpec(changeName: string, specId: string): Promise<string | null>;
  listArchivedChanges(): Promise<ArchivedChangeInfo[]>;
  /** 当 CLI list --specs 为空时，从 changes 目录扫描 delta specs */
  listSpecsFromChanges(): Promise<SpecInfo[]>;
  /** 读主 spec 内容（openspec/specs/<id>/spec.md） */
  readSpec(specId: string): Promise<string>;
}
