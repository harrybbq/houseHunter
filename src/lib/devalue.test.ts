import { describe, it, expect } from 'vitest';
import { decodePageModel, extractPageModelJson, readPageModel, resolveDevalue } from './devalue';

describe('resolveDevalue', () => {
  it('resolves primitives and nested references from index 0', () => {
    const flat = [{ propertyData: 1, flag: 6 }, { id: 2, prices: 3, tags: 5 }, '123', { primaryPrice: 4 }, '£210,000', [2, 4], true];
    expect(resolveDevalue(flat)).toEqual({
      propertyData: { id: '123', prices: { primaryPrice: '£210,000' }, tags: ['123', '£210,000'] },
      flag: true,
    });
  });

  it('maps negative sentinels', () => {
    const r = resolveDevalue([{ a: -1, b: -3, c: -4, d: -5, e: 1 }, null]) as Record<string, unknown>;
    expect(r.a).toBeUndefined();
    expect(Number.isNaN(r.b)).toBe(true);
    expect(r.c).toBe(Infinity);
    expect(r.d).toBe(-Infinity);
    expect(r.e).toBeNull();
  });

  it('handles cycles by memoising', () => {
    const flat = [{ self: 0, child: 1 }, { parent: 0, name: 2 }, 'kid'];
    const r = resolveDevalue(flat) as any;
    expect(r.self).toBe(r);
    expect(r.child.parent).toBe(r);
    expect(r.child.name).toBe('kid');
  });

  it('shares repeated references', () => {
    const r = resolveDevalue([{ a: 1, b: 1 }, { x: 2 }, 5]) as any;
    expect(r.a).toBe(r.b);
  });

  it('handles typed entries (Date, Set, Map)', () => {
    const r = resolveDevalue([{ d: 1, s: 2, m: 3 }, ['Date', '2026-09-01T00:00:00.000Z'], ['Set', 4], ['Map', 4, 5], 'k', 'v']) as any;
    expect(r.d).toBeInstanceOf(Date);
    expect([...r.s]).toEqual(['k']);
    expect(r.m.get('k')).toBe('v');
  });

  it('is defensive with junk', () => {
    expect(resolveDevalue([])).toBeUndefined();
    expect(resolveDevalue(-1)).toBeUndefined();
    expect(resolveDevalue([{ a: 99 }])).toEqual({ a: undefined });
  });
});

describe('page model extraction', () => {
  const data = JSON.stringify([{ propertyData: 1 }, { id: 2 }, '42']);
  it('accepts window.__PAGE_MODEL and window.PAGE_MODEL', () => {
    for (const name of ['window.__PAGE_MODEL', 'window.PAGE_MODEL']) {
      const html = `<script>${name} = ${JSON.stringify({ data, encoding: 'on' })};\nwindow.adInfo = {};</script>`;
      expect(readPageModel(html)).toEqual({ propertyData: { id: '42' } });
    }
  });

  it('accepts plain JSON with propertyData directly', () => {
    const html = `<script>window.PAGE_MODEL = {"propertyData":{"id":"7","text":{"description":"a } brace"}}}</script>`;
    expect(extractPageModelJson(html)).toContain('"id":"7"');
    expect((readPageModel(html) as any).propertyData.text.description).toBe('a } brace');
  });

  it('returns null for missing or broken models', () => {
    expect(readPageModel('<html></html>')).toBeNull();
    expect(readPageModel('window.PAGE_MODEL = {"data":"[not json"}')).toBeNull();
    expect(decodePageModel(null)).toBeNull();
  });
});
