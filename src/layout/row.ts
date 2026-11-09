import type { Rect } from '../types';

export interface Size {
  width: number;
  height: number;
}
export interface LayoutOptions {
  rowHeight: number;
  gap: number;
  padding: number;
}
export interface LayoutResult {
  items: Rect[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface Template {
  name: string;
  layout(sizes: Size[], opts: LayoutOptions): LayoutResult;
}

export function layoutRow(sizes: Size[], opts: LayoutOptions): LayoutResult {
  if (sizes.length === 0) return { items: [], canvasWidth: 0, canvasHeight: 0 };
  const { rowHeight, gap, padding } = opts;
  let x = padding;
  const items = sizes.map((s) => {
    const width = Math.max(1, Math.round((rowHeight * s.width) / s.height));
    const r = { x, y: padding, width, height: rowHeight };
    x += width + gap;
    return r;
  });
  const sum = items.reduce((a, i) => a + i.width, 0);
  return {
    items,
    canvasWidth: padding * 2 + sum + gap * (sizes.length - 1),
    canvasHeight: rowHeight + padding * 2,
  };
}

export const rowTemplate: Template = { name: 'row', layout: layoutRow };

export function defaultRowHeight(sizes: Size[]): number {
  if (sizes.length === 0) return 400;
  const min = Math.min(...sizes.map((s) => s.height));
  return Math.min(1600, Math.max(200, min));
}

/** Size of a photo after a lossless quarter-turn rotation. */
export function orientedSize(s: Size, orientation: number): Size {
  return orientation % 180 === 0 ? s : { width: s.height, height: s.width };
}

/** Index at which an item whose centre is at `x` is inserted between items with these centres. */
export function insertionIndex(sortedCenters: number[], x: number): number {
  let i = 0;
  while (i < sortedCenters.length && sortedCenters[i] < x) i++;
  return i;
}

/** Row height that makes a row of these photos (approximately) `width` wide. */
export function rowHeightForWidth(
  sizes: Size[],
  width: number,
  gap: number,
  padding: number,
): number {
  if (sizes.length === 0) return 0;
  const aspectSum = sizes.reduce((a, s) => a + s.width / s.height, 0);
  const free = width - padding * 2 - gap * (sizes.length - 1);
  return Math.floor(free / aspectSum);
}

/** Row height that makes the canvas `height` tall. */
export function rowHeightForHeight(height: number, padding: number): number {
  return Math.round(height - padding * 2);
}
