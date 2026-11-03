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
