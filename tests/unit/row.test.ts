import { describe, expect, it } from 'vitest';
import { layoutRow } from '../../src/layout/row';

const opts = { rowHeight: 300, gap: 16, padding: 32 };

describe('layoutRow', () => {
  it('preserves aspect ratio', () => {
    const r = layoutRow(
      [
        { width: 400, height: 300 },
        { width: 300, height: 600 },
      ],
      opts,
    );
    expect(r.items.map((i) => i.width)).toEqual([400, 150]);
    expect(r.items.every((i) => i.height === 300)).toBe(true);
  });
  it('accumulates x with gap', () => {
    const r = layoutRow(
      [
        { width: 400, height: 300 },
        { width: 300, height: 600 },
      ],
      opts,
    );
    expect(r.items[0].x).toBe(32);
    expect(r.items[1].x).toBe(32 + 400 + 16);
    expect(r.items[1].y).toBe(32);
  });
  it('computes canvas size', () => {
    const r = layoutRow(
      [
        { width: 400, height: 300 },
        { width: 300, height: 600 },
      ],
      opts,
    );
    expect(r.canvasWidth).toBe(64 + 550 + 16);
    expect(r.canvasHeight).toBe(364);
  });
  it('handles n = 0', () => {
    expect(layoutRow([], opts)).toEqual({ items: [], canvasWidth: 0, canvasHeight: 0 });
  });
  it('handles n = 1', () => {
    const r = layoutRow([{ width: 500, height: 500 }], opts);
    expect(r.canvasWidth).toBe(64 + 300);
    expect(r.items).toHaveLength(1);
  });
  it('does not drift more than 1px per item', () => {
    const sizes = Array.from({ length: 20 }, () => ({ width: 333, height: 777 }));
    const r = layoutRow(sizes, opts);
    r.items.forEach((i) => expect(Math.abs(i.width - (300 * 333) / 777)).toBeLessThanOrEqual(1));
  });
});
