import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileManagerService } from '@extension/services/fileManager';
import type { ArchivedChangeInfo } from '@extension/services/types';

vi.mock('@extension/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FileManagerService', () => {
  let tmpDir: string;
  let openspecDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'openspec-test-'));
    openspecDir = path.join(tmpDir, 'openspec');
    await fs.promises.mkdir(openspecDir, { recursive: true });
    await fs.promises.mkdir(path.join(openspecDir, 'changes'), { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('file path resolution', () => {
    it('getArtifactPath returns correct path for proposal', () => {
      const fm = new FileManagerService(openspecDir);
      const p = fm.getArtifactPath('my-change', 'proposal');
      expect(p).toBe(path.join(openspecDir, 'changes', 'my-change', 'proposal.md'));
    });

    it('getArtifactPath returns correct path for design and tasks', () => {
      const fm = new FileManagerService(openspecDir);
      expect(fm.getArtifactPath('my-change', 'design')).toBe(
        path.join(openspecDir, 'changes', 'my-change', 'design.md')
      );
      expect(fm.getArtifactPath('my-change', 'tasks')).toBe(
        path.join(openspecDir, 'changes', 'my-change', 'tasks.md')
      );
    });

    it('getArtifactPath for archived change uses archive directory', () => {
      const fm = new FileManagerService(openspecDir);
      const p = fm.getArtifactPath('archive:2025-01-15-my-change', 'proposal');
      expect(p).toBe(
        path.join(openspecDir, 'changes', 'archive', '2025-01-15-my-change', 'proposal.md')
      );
    });

    it('getArtifactPath for specs returns specs directory', () => {
      const fm = new FileManagerService(openspecDir);
      const p = fm.getArtifactPath('my-change', 'specs');
      expect(p).toBe(path.join(openspecDir, 'changes', 'my-change', 'specs'));
    });
  });

  describe('error handling for missing files', () => {
    it('artifactExists returns false when file does not exist', async () => {
      const fm = new FileManagerService(openspecDir);
      const exists = await fm.artifactExists('non-existent-change', 'proposal');
      expect(exists).toBe(false);
    });

    it('artifactExists returns true when file exists', async () => {
      const changeDir = path.join(openspecDir, 'changes', 'my-change');
      await fs.promises.mkdir(changeDir, { recursive: true });
      await fs.promises.writeFile(path.join(changeDir, 'proposal.md'), '# Proposal', 'utf-8');
      const fm = new FileManagerService(openspecDir);
      const exists = await fm.artifactExists('my-change', 'proposal');
      expect(exists).toBe(true);
    });

    it('readArtifact throws when file does not exist', async () => {
      const fm = new FileManagerService(openspecDir);
      await expect(fm.readArtifact('non-existent-change', 'proposal')).rejects.toThrow();
    });

    it('readArtifact returns content when file exists', async () => {
      const changeDir = path.join(openspecDir, 'changes', 'my-change');
      await fs.promises.mkdir(changeDir, { recursive: true });
      const content = '# Proposal\n\nSome content.';
      await fs.promises.writeFile(path.join(changeDir, 'proposal.md'), content, 'utf-8');
      const fm = new FileManagerService(openspecDir);
      const result = await fm.readArtifact('my-change', 'proposal');
      expect(result).toBe(content);
    });
  });

  describe('Content Access interface (listDeltaSpecIds, listArchivedChanges, listSpecsFromChanges)', () => {
    it('listDeltaSpecIds returns empty when no specs dir', async () => {
      const changeDir = path.join(openspecDir, 'changes', 'my-change');
      await fs.promises.mkdir(changeDir, { recursive: true });
      const fm = new FileManagerService(openspecDir);
      const result = await fm.listDeltaSpecIds('my-change');
      expect(result).toEqual([]);
    });

    it('listDeltaSpecIds returns spec ids when specs exist', async () => {
      const changeDir = path.join(openspecDir, 'changes', 'my-change');
      const specsDir = path.join(changeDir, 'specs');
      await fs.promises.mkdir(path.join(specsDir, 'delta-a'), { recursive: true });
      await fs.promises.writeFile(path.join(specsDir, 'delta-a', 'spec.md'), '# Spec', 'utf-8');
      await fs.promises.mkdir(path.join(specsDir, 'delta-b'), { recursive: true });
      await fs.promises.writeFile(path.join(specsDir, 'delta-b', 'spec.md'), '# Spec', 'utf-8');
      const fm = new FileManagerService(openspecDir);
      const result = await fm.listDeltaSpecIds('my-change');
      expect(result.sort()).toEqual(['delta-a', 'delta-b']);
    });

    it('listArchivedChanges returns empty when no archive dir', async () => {
      const fm = new FileManagerService(openspecDir);
      const result = await fm.listArchivedChanges();
      expect(result).toEqual([]);
    });

    it('listArchivedChanges returns parsed directory names', async () => {
      const archiveDir = path.join(openspecDir, 'changes', 'archive');
      await fs.promises.mkdir(path.join(archiveDir, '2025-01-15-my-change'), { recursive: true });
      await fs.promises.mkdir(path.join(archiveDir, '2025-01-10-other'), { recursive: true });
      const fm = new FileManagerService(openspecDir);
      const result = await fm.listArchivedChanges();
      expect(result).toHaveLength(2);
      expect(result.map((r: ArchivedChangeInfo) => r.directoryName).sort()).toEqual([
        '2025-01-10-other',
        '2025-01-15-my-change',
      ]);
      const myChange = result.find((r: ArchivedChangeInfo) => r.name === 'my-change');
      expect(myChange?.archiveDate).toBe('2025-01-15');
    });

    it('listSpecsFromChanges returns empty when no changes', async () => {
      const fm = new FileManagerService(openspecDir);
      const result = await fm.listSpecsFromChanges();
      expect(result).toEqual([]);
    });

    it('listSpecsFromChanges returns specs from change specs dirs', async () => {
      const changeDir = path.join(openspecDir, 'changes', 'foo');
      const specPath = path.join(changeDir, 'specs', 'bar', 'spec.md');
      await fs.promises.mkdir(path.dirname(specPath), { recursive: true });
      await fs.promises.writeFile(
        specPath,
        '### Requirement: R1\n\n### Requirement: R2\n',
        'utf-8'
      );
      const fm = new FileManagerService(openspecDir);
      const result = await fm.listSpecsFromChanges();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('foo / bar');
      expect(result[0].requirementCount).toBe(2);
    });
  });
});
