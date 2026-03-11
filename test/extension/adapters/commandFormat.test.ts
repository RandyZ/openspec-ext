import { describe, it, expect } from 'vitest';

function toHyphenFormat(command: string): string {
  return command.replace(/\/opsx:/g, '/opsx-');
}

describe('Command format adaptation', () => {
  it('converts /opsx:apply to /opsx-apply', () => {
    expect(toHyphenFormat('/opsx:apply foo')).toBe('/opsx-apply foo');
  });

  it('converts /opsx:verify to /opsx-verify', () => {
    expect(toHyphenFormat('/opsx:verify change-name')).toBe('/opsx-verify change-name');
  });

  it('converts /opsx:continue to /opsx-continue', () => {
    expect(toHyphenFormat('/opsx:continue my-change')).toBe('/opsx-continue my-change');
  });

  it('converts /opsx:ff to /opsx-ff', () => {
    expect(toHyphenFormat('/opsx:ff my-change')).toBe('/opsx-ff my-change');
  });

  it('converts /opsx:explore to /opsx-explore', () => {
    expect(toHyphenFormat('/opsx:explore')).toBe('/opsx-explore');
  });

  it('converts /opsx:sync to /opsx-sync', () => {
    expect(toHyphenFormat('/opsx:sync change-name')).toBe('/opsx-sync change-name');
  });

  it('leaves non-opsx commands unchanged', () => {
    expect(toHyphenFormat('hello world')).toBe('hello world');
    expect(toHyphenFormat('/some:other command')).toBe('/some:other command');
  });
});
