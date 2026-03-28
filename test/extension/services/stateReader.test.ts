import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateReader } from '@extension/services/stateReader';
import type { IOpenSpecCliGateway } from '@extension/services/stateReader';
import type { IOpenSpecContentAccess, Task } from '@extension/services/contentAccess';
import type { ChangeInfo, ChangeDetails, SpecInfo, ArchivedChangeInfo } from '@extension/services/types';

vi.mock('@extension/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('StateReader', () => {
  let mockGateway: IOpenSpecCliGateway;
  let mockContentAccess: IOpenSpecContentAccess;

  beforeEach(() => {
    mockGateway = {
      listChanges: vi.fn().mockResolvedValue([]),
      getChangeStatus: vi.fn().mockResolvedValue({ artifacts: [] }),
      showChange: vi.fn().mockResolvedValue({
        name: 'test-change',
        schema: 'spec-driven',
        artifacts: [],
        tasks: [],
      }),
      listSpecs: vi.fn().mockResolvedValue([]),
    };
    mockContentAccess = {
      readArtifact: vi.fn(),
      artifactExists: vi.fn().mockResolvedValue(false),
      readTasks: vi.fn().mockResolvedValue([]),
      getDirectChildIndices: vi.fn().mockReturnValue([]),
      toggleTask: vi.fn().mockResolvedValue(undefined),
      autoCompleteParents: vi.fn().mockResolvedValue(undefined),
      listDeltaSpecIds: vi.fn().mockResolvedValue([]),
      readDeltaSpec: vi.fn().mockResolvedValue(null),
      listArchivedChanges: vi.fn().mockResolvedValue([]),
      listSpecsFromChanges: vi.fn().mockResolvedValue([]),
      listMainSpecs: vi.fn().mockResolvedValue([]),
      readSpec: vi.fn().mockRejectedValue(new Error('not implemented')),
      getChangeOpenspecYamlPath: vi.fn().mockReturnValue(''),
    };
  });

  it('listChanges delegates to gateway', async () => {
    const changes: ChangeInfo[] = [
      {
        name: 'foo',
        completedTasks: 0,
        totalTasks: 1,
        lastModified: '',
        status: 'draft',
      },
    ];
    vi.mocked(mockGateway.listChanges).mockResolvedValue(changes);
    const reader = new StateReader(mockGateway, mockContentAccess);
    const result = await reader.listChanges();
    expect(result).toEqual(changes);
    expect(mockGateway.listChanges).toHaveBeenCalledTimes(1);
  });

  it('getChangeDetails delegates to gateway', async () => {
    const details: ChangeDetails = {
      name: 'my-change',
      schema: 'spec-driven',
      artifacts: [],
      tasks: [],
    };
    vi.mocked(mockGateway.showChange).mockResolvedValue(details);
    const reader = new StateReader(mockGateway, mockContentAccess);
    const result = await reader.getChangeDetails('my-change');
    expect(result).toEqual(details);
    expect(mockGateway.showChange).toHaveBeenCalledWith('my-change');
  });

  it('getTasks uses contentAccess when CLI tasks not compatible with UI', async () => {
    const tasksFromFile: Task[] = [
      {
        lineIndex: 0,
        indent: 0,
        done: false,
        text: 'Task one',
        originalLine: '- [ ] Task one',
      },
    ];
    vi.mocked(mockGateway.showChange).mockResolvedValue({
      name: 'c',
      schema: 's',
      artifacts: [],
      tasks: [{ id: '1', description: 'Task one', done: false }],
    });
    vi.mocked(mockContentAccess.readTasks).mockResolvedValue(tasksFromFile);
    const reader = new StateReader(mockGateway, mockContentAccess);
    const result = await reader.getTasks('my-change');
    expect(result).toEqual(tasksFromFile);
    expect(mockContentAccess.readTasks).toHaveBeenCalledWith('my-change');
  });

  it('listSpecs merges main specs and delta specs', async () => {
    const mainSpecs: SpecInfo[] = [{ id: 'dashboard', requirementCount: 5 }];
    const deltaSpecs: SpecInfo[] = [{ id: 'new-feature', requirementCount: 2 }];
    vi.mocked(mockContentAccess.listMainSpecs).mockResolvedValue(mainSpecs);
    vi.mocked(mockContentAccess.listSpecsFromChanges).mockResolvedValue(deltaSpecs);
    const reader = new StateReader(mockGateway, mockContentAccess);
    const result = await reader.listSpecs();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('dashboard');
    expect(result[1].id).toBe('new-feature');
  });

  it('listSpecs deduplicates by id (main takes precedence)', async () => {
    const mainSpecs: SpecInfo[] = [{ id: 'dashboard', requirementCount: 5 }];
    const deltaSpecs: SpecInfo[] = [{ id: 'dashboard', requirementCount: 1 }];
    vi.mocked(mockContentAccess.listMainSpecs).mockResolvedValue(mainSpecs);
    vi.mocked(mockContentAccess.listSpecsFromChanges).mockResolvedValue(deltaSpecs);
    const reader = new StateReader(mockGateway, mockContentAccess);
    const result = await reader.listSpecs();
    expect(result).toHaveLength(1);
    expect(result[0].requirementCount).toBe(5);
  });

  it('listArchivedChanges delegates to contentAccess', async () => {
    const archived: ArchivedChangeInfo[] = [
      { directoryName: '2025-01-15-foo', name: 'foo', archiveDate: '2025-01-15' },
    ];
    vi.mocked(mockContentAccess.listArchivedChanges).mockResolvedValue(archived);
    const reader = new StateReader(mockGateway, mockContentAccess);
    const result = await reader.listArchivedChanges();
    expect(result).toEqual(archived);
    expect(mockContentAccess.listArchivedChanges).toHaveBeenCalledTimes(1);
  });

  it('artifactExists uses contentAccess when show has no matching artifact', async () => {
    vi.mocked(mockGateway.showChange).mockResolvedValue({
      name: 'c',
      schema: 's',
      artifacts: [{ id: 'proposal', outputPath: '', status: 'done' }],
      tasks: [],
    });
    vi.mocked(mockContentAccess.artifactExists).mockResolvedValue(true);
    const reader = new StateReader(mockGateway, mockContentAccess);
    const result = await reader.artifactExists('c', 'tasks');
    expect(result).toBe(true);
    expect(mockContentAccess.artifactExists).toHaveBeenCalledWith('c', 'tasks');
  });
});
