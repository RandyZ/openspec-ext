export interface AgentAdapterOption {
  id: string;
  displayName: string;
}

export interface AgentAdaptersState {
  available: AgentAdapterOption[];
  currentId: string | null;
}

export function normalizeAgentAdaptersState(
  available: AgentAdapterOption[],
  currentId: string | null | undefined,
): AgentAdaptersState {
  const availableIds = available.map((adapter) => adapter.id);
  let normalizedCurrentId = currentId ?? null;

  if (normalizedCurrentId && !availableIds.includes(normalizedCurrentId)) {
    normalizedCurrentId = availableIds[0] ?? null;
  }

  if (!normalizedCurrentId && availableIds.length === 1) {
    normalizedCurrentId = availableIds[0];
  }

  return {
    available,
    currentId: normalizedCurrentId,
  };
}
