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

describe('pan and free rotation', () => {
  it('stores arbitrary angle and clamped pan; live changes need commitView', async () => {
    const { commitView, setItemView, addImages, getState, undo } = await import('../../src/state');
    addImages([bmp()]);
    const id = getState().items.at(-1)!.id;
    setItemView(id, { rotation: 12.5, panY: 5, panX: -0.25 });
    let it = getState().items.find((i) => i.id === id)!;
    expect([it.rotation, it.panY, it.panX]).toEqual([12.5, 1, -0.25]);
    setItemView(id, { panY: 0.1 }, false);
    setItemView(id, { panY: 0.2 }, false);
    commitView();
    undo();
    it = getState().items.find((i) => i.id === id)!;
    expect(it.panY).toBe(1);
    undo();
    it = getState().items.find((i) => i.id === id)!;
    expect([it.rotation, it.panY, it.panX]).toEqual([0, 0, 0]);
  });
});
