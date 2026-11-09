import { beforeEach, describe, expect, it } from 'vitest';
import { insertionIndex, orientedSize, rowHeightForWidth } from '../../src/layout/row';
import { sortByName } from '../../src/io/import';
import {
  addImages,
  clearAll,
  deleteSelected,
  dropInRow,
  getState,
  moveItem,
  rotateAll,
  rotateItem,
  rowOrder,
  select,
  setCanvasSize,
  setItemView,
  setLayoutMode,
  shiftInRow,
  undo,
  updateSettings,
} from '../../src/state';

function bmp(width: number, height: number): ImageBitmap {
  return { width, height, close() {} } as unknown as ImageBitmap;
}

const ids = (): string[] => rowOrder().map((i) => i.id);

beforeEach(() => {
  setLayoutMode('row');
  clearAll();
  updateSettings({ gap: 10, padding: 20, rowHeight: 100 });
});

describe('row helpers', () => {
  it('orientedSize swaps sides for quarter turns', () => {
    expect(orientedSize({ width: 4, height: 3 }, 90)).toEqual({ width: 3, height: 4 });
    expect(orientedSize({ width: 4, height: 3 }, 180)).toEqual({ width: 4, height: 3 });
  });
  it('insertionIndex', () => {
    expect(insertionIndex([10, 20, 30], 5)).toBe(0);
    expect(insertionIndex([10, 20, 30], 25)).toBe(2);
    expect(insertionIndex([10, 20, 30], 99)).toBe(3);
  });
  it('rowHeightForWidth', () => {
    // two 2:1 photos, gap 10, padding 20 → 2*2h + 10 + 40 = 1050 → h = 250
    const s = { width: 200, height: 100 };
    expect(rowHeightForWidth([s, s], 1050, 10, 20)).toBe(250);
  });
  it('sortByName uses natural order', () => {
    const names = sortByName([
      { name: 'IMG_10.jpg' },
      { name: 'img_2.jpg' },
      { name: 'IMG_1.jpg' },
    ]);
    expect(names.map((n) => n.name)).toEqual(['IMG_1.jpg', 'img_2.jpg', 'IMG_10.jpg']);
  });
});

describe('lossless 90° rotation', () => {
  it('turns a landscape photo into a portrait frame without cropping and re-flows the row', () => {
    addImages([bmp(400, 300), bmp(400, 300)]);
    updateSettings({ rowHeight: 300 });
    const [a, b] = rowOrder();
    expect([a.width, a.height]).toEqual([400, 300]);
    rotateItem(a.id, 90);
    const [a2, b2] = rowOrder();
    expect(a2.id).toBe(a.id);
    expect(a2.orientation).toBe(90);
    expect([a2.width, a2.height]).toEqual([225, 300]);
    expect(a2.rotation).toBe(0); // content is not rotated inside a fixed frame
    expect(a2.zoom).toBe(1);
    expect(b2.x).toBe(a2.x + a2.width + 10); // neighbour moved, no gap/overlap
    expect(b2.id).toBe(b.id);
    expect(getState().canvasWidth).toBe(20 * 2 + 225 + 10 + 400);
  });

  it('rotates all photos in one undo step', () => {
    addImages([bmp(400, 300), bmp(300, 400)]);
    const before = getState().items.map((i) => [i.width, i.height]);
    rotateAll(90);
    expect(getState().items.map((i) => i.orientation)).toEqual([90, 90]);
    rotateAll(90);
    rotateAll(90);
    rotateAll(90);
    expect(getState().items.map((i) => i.orientation)).toEqual([0, 0]);
    rotateAll(-90);
    expect(getState().items.map((i) => i.orientation)).toEqual([270, 270]);
    undo();
    expect(getState().items.map((i) => [i.width, i.height])).toEqual(before);
  });

  it('keeps the crop pointing at the same part of the photo', () => {
    addImages([bmp(400, 300)]);
    const id = getState().items[0].id;
    setItemView(id, { zoom: 2, panX: 0.2, panY: -0.1 });
    rotateItem(id, 90);
    const it = getState().items[0];
    expect([it.panX, it.panY]).toEqual([0.1, 0.2]);
    rotateItem(id, -90);
    const back = getState().items[0];
    expect([back.panX, back.panY]).toEqual([0.2, -0.1]);
  });

  it('free mode swaps the frame around its centre', () => {
    addImages([bmp(400, 200)]);
    setLayoutMode('free');
    setCanvasSize(1000, 1000);
    moveItem(getState().items[0].id, 300, 400);
    const it = getState().items[0];
    const cx = it.x + it.width / 2;
    const cy = it.y + it.height / 2;
    rotateItem(it.id, 90);
    const r = getState().items[0];
    expect([r.width, r.height]).toEqual([it.height, it.width]);
    expect(r.x + r.width / 2).toBeCloseTo(cx);
    expect(r.y + r.height / 2).toBeCloseTo(cy);
  });
});

describe('row mode', () => {
  it('reorders by drop position and by shifting', () => {
    addImages([bmp(100, 100), bmp(100, 100), bmp(100, 100)]);
    const [a, b, c] = ids();
    dropInRow(a, 1e6);
    expect(ids()).toEqual([b, c, a]);
    shiftInRow(a, -1);
    expect(ids()).toEqual([b, a, c]);
    shiftInRow(b, -1); // already first
    expect(ids()).toEqual([b, a, c]);
  });

  it('closes the gap after deleting a photo', () => {
    addImages([bmp(100, 100), bmp(100, 100), bmp(100, 100)]);
    const [a, , c] = ids();
    select(ids()[1]);
    deleteSelected();
    const [a2, c2] = rowOrder();
    expect([a2.id, c2.id]).toEqual([a, c]);
    expect(c2.x).toBe(a2.x + a2.width + 10);
  });

  it('setting the width picks a row height that fits it', () => {
    addImages([bmp(200, 100), bmp(200, 100)]);
    setCanvasSize(1050, getState().canvasHeight);
    expect(getState().settings.rowHeight).toBe(250);
    expect(getState().canvasWidth).toBe(1050);
  });

  it('switching back to row mode re-flows freely placed photos', () => {
    addImages([bmp(100, 100), bmp(100, 100)]);
    setLayoutMode('free');
    const [a, b] = ids();
    setCanvasSize(2000, 2000);
    dropInRow(a, 1e6); // no-op outside row mode
    expect(ids()).toEqual([a, b]);
    setLayoutMode('row');
    const items = rowOrder();
    expect(items.every((i) => i.y === 20 && i.height === getState().settings.rowHeight)).toBe(true);
    expect(new Set(items.map((i) => i.id))).toEqual(new Set([a, b]));
  });
});
