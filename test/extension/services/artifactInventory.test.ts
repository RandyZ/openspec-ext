import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  buildOtherArtifacts,
  toKnownTopLevelName,
  resolveOpenablePath,
} from '@extension/services/artifactInventory';

describe('artifactInventory', () => {
  let tmpDir: string;
  let changeDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'openspec-inventory-'));
    changeDir = path.join(tmpDir, 'openspec', 'changes', 'demo-change');
    await fs.promises.mkdir(changeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('toKnownTopLevelName', () => {
    it('handles schema-relative single files', () => {
      expect(toKnownTopLevelName('proposal.md')).toBe('proposal.md');
      expect(toKnownTopLevelName('design.md')).toBe('design.md');
    });

    it('handles glob directory artifacts', () => {
      expect(toKnownTopLevelName('specs/**/*.md')).toBe('specs');
    });

    it('strips openspec/changes/<name>/ prefixes from filesystem fallback paths', () => {
      expect(
        toKnownTopLevelName('openspec/changes/demo-change/proposal.md', 'demo-change')
      ).toBe('proposal.md');
      expect(
        toKnownTopLevelName('openspec/changes/demo-change/specs', 'demo-change')
      ).toBe('specs');
    });
  });

  describe('buildOtherArtifacts', () => {
    it('excludes known schema files and returns empty when nothing else exists', async () => {
      await fs.promises.writeFile(path.join(changeDir, 'proposal.md'), '# p');
      await fs.promises.writeFile(path.join(changeDir, 'design.md'), '# d');
      await fs.promises.writeFile(path.join(changeDir, 'tasks.md'), '# t');
      await fs.promises.mkdir(path.join(changeDir, 'specs'));
      await fs.promises.writeFile(path.join(changeDir, '.openspec.yaml'), 'x: 1');

      const other = await buildOtherArtifacts(
        changeDir,
        ['proposal.md', 'design.md', 'tasks.md', 'specs/**/*.md'],
        'demo-change'
      );
      expect(other).toEqual([]);
    });

    it('identifies undeclared files and directories', async () => {
      await fs.promises.writeFile(path.join(changeDir, 'proposal.md'), '# p');
      await fs.promises.writeFile(path.join(changeDir, 'notes.md'), '# n');
      await fs.promises.mkdir(path.join(changeDir, 'task-details'));
      await fs.promises.writeFile(path.join(changeDir, 'task-details', '01.md'), 'a');
      await fs.promises.writeFile(path.join(changeDir, 'task-details', '02.md'), 'b');
      await fs.promises.writeFile(path.join(changeDir, '.openspec.yaml'), 'x: 1');
      await fs.promises.writeFile(path.join(changeDir, '.hidden'), 'h');

      const other = await buildOtherArtifacts(changeDir, ['proposal.md'], 'demo-change');
      expect(other).toHaveLength(2);
      expect(other.map((e) => e.relativePath).sort()).toEqual(['notes.md', 'task-details']);

      const notes = other.find((e) => e.relativePath === 'notes.md')!;
      expect(notes.isDirectory).toBe(false);
      expect(notes.fileCount).toBe(1);
      expect(notes.id).toBe('notes.md');

      const details = other.find((e) => e.relativePath === 'task-details')!;
      expect(details.isDirectory).toBe(true);
      expect(details.fileCount).toBe(2);
      expect(details.id).toBe('task-details');
    });

    it('works with filesystem-fallback known paths', async () => {
      await fs.promises.writeFile(path.join(changeDir, 'proposal.md'), '# p');
      await fs.promises.mkdir(path.join(changeDir, 'analysis'));
      await fs.promises.writeFile(path.join(changeDir, 'analysis', 'a.md'), 'a');

      const other = await buildOtherArtifacts(
        changeDir,
        ['openspec/changes/demo-change/proposal.md'],
        'demo-change'
      );
      expect(other).toHaveLength(1);
      expect(other[0].relativePath).toBe('analysis');
      expect(other[0].fileCount).toBe(1);
    });

    it('returns empty array when change directory is missing', async () => {
      const missing = path.join(tmpDir, 'does-not-exist');
      const other = await buildOtherArtifacts(missing, ['proposal.md']);
      expect(other).toEqual([]);
    });
  });

  describe('resolveOpenablePath', () => {
    it('resolves single files and glob directories', () => {
      expect(resolveOpenablePath(changeDir, 'proposal.md')).toBe(
        path.join(changeDir, 'proposal.md')
      );
      expect(resolveOpenablePath(changeDir, 'specs/**/*.md')).toBe(
        path.join(changeDir, 'specs')
      );
    });
  });
});
