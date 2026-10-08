import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkflowRequestId } from '../../shared/changeWorkflow';
import type { WorkflowActionReceipt } from '../../shared/changeWorkflow';

export const WORKFLOW_LAUNCH_PENDING_TIMEOUT_MS = 45_000;
export const WORKFLOW_LAUNCH_PENDING_MIN_VISIBLE_MS = 400;

export function workflowLaunchPendingKey(changeName: string, bindingKey: string): string {
  return `${changeName}\u0000${bindingKey}`;
}

export function useWorkflowLaunchPending(onTimeout?: () => void) {
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const pendingRequestsRef = useRef(new Map<string, { changeName: string; bindingKey: string }>());
  const latestRequestRef = useRef(new Map<string, string>());
  const timeoutHandlesRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingStartedAtRef = useRef(new Map<string, number>());

  const clearPendingKey = useCallback((key: string) => {
    setPendingKeys((previous) => {
      if (!previous.has(key)) return previous;
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
    const handle = timeoutHandlesRef.current.get(key);
    if (handle) {
      clearTimeout(handle);
      timeoutHandlesRef.current.delete(key);
    }
  }, []);

  const registerLaunch = useCallback((
    changeName: string,
    bindingKey: string,
    requestPrefix = 'workflow',
  ) => {
    const requestId = createWorkflowRequestId(requestPrefix);
    const key = workflowLaunchPendingKey(changeName, bindingKey);
    pendingRequestsRef.current.set(requestId, { changeName, bindingKey });
    latestRequestRef.current.set(key, requestId);
    setPendingKeys((previous) => new Set(previous).add(key));
    pendingStartedAtRef.current.set(key, Date.now());

    const existing = timeoutHandlesRef.current.get(key);
    if (existing) clearTimeout(existing);
    timeoutHandlesRef.current.set(
      key,
      setTimeout(() => {
        clearPendingKey(key);
        onTimeout?.();
      }, WORKFLOW_LAUNCH_PENDING_TIMEOUT_MS),
    );

    return { requestId, key };
  }, [clearPendingKey, onTimeout]);

  const handleReceipt = useCallback((message: WorkflowActionReceipt) => {
    const pending = pendingRequestsRef.current.get(message.requestId);
    const key = workflowLaunchPendingKey(message.changeName, message.bindingKey);
    if (
      !pending
      || pending.changeName !== message.changeName
      || pending.bindingKey !== message.bindingKey
      || latestRequestRef.current.get(key) !== message.requestId
    ) {
      return;
    }
    if (message.status === 'running') return;
    pendingRequestsRef.current.delete(message.requestId);
    const startedAt = pendingStartedAtRef.current.get(key) ?? Date.now();
    const delay = Math.max(0, WORKFLOW_LAUNCH_PENDING_MIN_VISIBLE_MS - (Date.now() - startedAt));
    if (delay > 0) {
      setTimeout(() => {
        clearPendingKey(key);
        pendingStartedAtRef.current.delete(key);
      }, delay);
    } else {
      clearPendingKey(key);
      pendingStartedAtRef.current.delete(key);
    }
  }, [clearPendingKey]);

  useEffect(() => () => {
    for (const handle of timeoutHandlesRef.current.values()) {
      clearTimeout(handle);
    }
    timeoutHandlesRef.current.clear();
  }, []);

  return {
    pendingKeys,
    registerLaunch,
    handleReceipt,
    isPending: (changeName: string, bindingKey?: string) =>
      bindingKey ? pendingKeys.has(workflowLaunchPendingKey(changeName, bindingKey)) : false,
  };
}
