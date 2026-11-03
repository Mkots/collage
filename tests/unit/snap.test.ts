import { describe, expect, it } from 'vitest';
import { computeSnap } from '../../src/snap/snap';

const canvas = { width: 1000, height: 800 };
const opts = { threshold: 8, gap: 16 };
const other = { x: 200, y: 200, width: 100, height: 100 };

describe('computeSnap', () => {
  it('snaps left to left within threshold', () => {
    const r = computeSnap({ x: 205, y: 500, width: 50, height: 50 }, [other], canvas, opts);
    expect(r.x).toBe(200);
    expect(r.y).toBe(500);
  });
  it('does not snap beyond threshold', () => {
    const r = computeSnap({ x: 120, y: 500, width: 50, height: 50 }, [other], canvas, opts);
    expect(r.x).toBe(120);
    expect(r.guides).toHaveLength(0);
  });
  it('nearest candidate wins', () => {
    // left edge at 203: target 200 (d=3) vs gap-less others
    const r = computeSnap(
      { x: 203, y: 500, width: 50, height: 50 },
      [other, { ...other, x: 207 }],
      canvas,
      opts,
    );
    expect(r.x).toBe(200);
  });
  it('snaps X and Y independently', () => {
    const r = computeSnap({ x: 203, y: 600, width: 50, height: 50 }, [other], canvas, opts);
    expect(r.x).toBe(200);
    expect(r.y).toBe(600);
    expect(r.guides.map((g) => g.orientation)).toEqual(['vertical']);
  });
  it('gap-aware snap', () => {
    const r = computeSnap({ x: 312, y: 500, width: 50, height: 50 }, [other], canvas, opts);
    expect(r.x).toBe(316);
  });
  it('snaps to canvas center', () => {
    const r = computeSnap({ x: 472, y: 100, width: 50, height: 50 }, [], canvas, opts);
    expect(r.x).toBe(475);
  });
  it('returns guides with orientation and position', () => {
    const r = computeSnap({ x: 205, y: 500, width: 50, height: 50 }, [other], canvas, opts);
    expect(r.guides).toEqual([{ orientation: 'vertical', position: 200, start: 200, end: 550 }]);
  });
  it('canvas guide spans full canvas', () => {
    const r = computeSnap({ x: 3, y: 100, width: 50, height: 50 }, [], canvas, opts);
    expect(r.guides).toEqual([{ orientation: 'vertical', position: 0, start: 0, end: 800 }]);
  });
  it('works with no others', () => {
    const r = computeSnap({ x: 400, y: 300, width: 50, height: 50 }, [], canvas, opts);
    expect(r).toEqual({ x: 400, y: 300, guides: [] });
  });
});
