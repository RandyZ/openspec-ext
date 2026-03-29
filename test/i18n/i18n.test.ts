import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale } from '../../src/i18n';
import en from '../../src/i18n/locales/en.json';
import zhCn from '../../src/i18n/locales/zh-cn.json';

describe('i18n', () => {
  describe('setLocale / getLocale', () => {
    it('defaults to en', () => {
      setLocale('en');
      expect(getLocale()).toBe('en');
    });

    it('zh-cn maps correctly', () => {
      setLocale('zh-cn');
      expect(getLocale()).toBe('zh-cn');
    });

    it('zh-CN maps to zh-cn', () => {
      setLocale('zh-CN');
      expect(getLocale()).toBe('zh-cn');
    });

    it('zh maps to zh-cn', () => {
      setLocale('zh');
      expect(getLocale()).toBe('zh-cn');
    });

    it('unknown locale falls back to en', () => {
      setLocale('fr');
      expect(getLocale()).toBe('en');
    });
  });

  describe('t() with English locale', () => {
    beforeEach(() => setLocale('en'));

    it('returns English text for known keys', () => {
      expect(t('task.execute')).toBe('Execute');
      expect(t('task.executing')).toBe('Executing...');
      expect(t('action.openInEditor')).toBe('Open in Editor');
      expect(t('action.refresh')).toBe('Refresh');
      expect(t('action.archiveChange')).toBe('Archive Change');
      expect(t('dashboard.statusDraft')).toBe('Draft');
      expect(t('dashboard.statusInProgress')).toBe('In progress');
      expect(t('dashboard.statusComplete')).toBe('Complete');
      expect(t('dashboard.archived')).toBe('Archived');
      expect(t('verify.completeness')).toContain('Completeness');
      expect(t('verify.correctness')).toContain('Correctness');
      expect(t('verify.coherence')).toContain('Coherence');
    });

    it('supports parameter substitution', () => {
      expect(t('command.created', { name: 'test-change' })).toBe('Change "test-change" created');
      expect(t('adapter.switched', { name: 'Clipboard' })).toBe('Switched executor to: Clipboard');
      expect(t('time.daysAgo', { days: 3 })).toBe('3d ago');
    });

    it('returns key for unknown keys', () => {
      expect(t('nonexistent.key' as any)).toBe('nonexistent.key');
    });
  });

  describe('t() with Chinese locale', () => {
    beforeEach(() => setLocale('zh-cn'));

    it('returns Chinese text for known keys', () => {
      expect(t('task.execute')).toBe('执行');
      expect(t('task.executing')).toBe('执行中...');
      expect(t('action.openInEditor')).toBe('在编辑器中打开');
      expect(t('action.refresh')).toBe('刷新');
      expect(t('action.archiveChange')).toBe('归档 Change');
      expect(t('dashboard.statusDraft')).toBe('草稿');
      expect(t('dashboard.statusInProgress')).toBe('进行中');
      expect(t('dashboard.statusComplete')).toBe('已完成');
      expect(t('dashboard.archived')).toBe('已归档');
      expect(t('verify.completeness')).toContain('完整性');
      expect(t('verify.correctness')).toContain('正确性');
      expect(t('verify.coherence')).toContain('一致性');
    });

    it('supports parameter substitution in Chinese', () => {
      expect(t('command.created', { name: 'test-change' })).toBe('Change "test-change" 已创建');
      expect(t('adapter.switched', { name: 'Clipboard' })).toBe('已切换执行者: Clipboard');
      expect(t('time.daysAgo', { days: 3 })).toBe('3天前');
      expect(t('time.weeksAgo', { weeks: 2 })).toBe('2周前');
    });
  });

  describe('locale file completeness', () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zhCn).sort();

    it('en and zh-cn have same number of keys', () => {
      expect(enKeys.length).toBe(zhKeys.length);
    });

    it('all en keys exist in zh-cn', () => {
      const missing = enKeys.filter(k => !zhKeys.includes(k));
      expect(missing).toEqual([]);
    });

    it('all zh-cn keys exist in en', () => {
      const extra = zhKeys.filter(k => !enKeys.includes(k));
      expect(extra).toEqual([]);
    });

    it('no empty values in en', () => {
      const empty = enKeys.filter(k => !(en as Record<string, string>)[k]?.trim());
      expect(empty).toEqual([]);
    });

    it('no empty values in zh-cn', () => {
      const empty = zhKeys.filter(k => !(zhCn as Record<string, string>)[k]?.trim());
      expect(empty).toEqual([]);
    });
  });
});
