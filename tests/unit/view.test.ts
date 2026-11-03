import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  addImages,
  getState,
  normalizeRotation,
  setItemView,
  undo,
} from '../../src/state';

function bmp(): ImageBitmap {
  return { width: 100, height: 50, close() {} } as unknown as ImageBitmap;
}

describe('normalizeRotation', () => {
  it('wraps into (-180, 180]', () => {
    expect(normalizeRotation(270)).toBe(-90);
    expect(normalizeRotation(-270)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(180)).toBe(180);
  });
});

describe('setItemView', () => {
  it('clamps zoom, normalizes rotation, keeps frame and supports undo', () => {
    addImages([bmp()]);
    const it = getState().items[0];
    setItemView(it.id, { zoom: 100, rotation: 450 });
    let cur = getState().items[0];
    expect(cur.zoom).toBe(MAX_ZOOM);
    expect(cur.rotation).toBe(90);
    expect([cur.x, cur.y, cur.width, cur.height]).toEqual([it.x, it.y, it.width, it.height]);
    setItemView(it.id, { zoom: 0 });
    expect(getState().items[0].zoom).toBe(MIN_ZOOM);
    undo();
    undo();
    cur = getState().items[0];
    expect(cur.zoom).toBe(1);
    expect(cur.rotation).toBe(0);
  });
});
