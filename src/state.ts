import { defaultRowHeight, layoutRow } from './layout/row';
import type { CollageItem, CollageSettings, CollageState } from './types';

const HISTORY_LIMIT = 50;
export const MIN_ITEM_SIDE = 40;

interface ItemGeom {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}
interface Snapshot {
  items: ItemGeom[];
  canvasWidth: number;
  canvasHeight: number;
  settings: CollageSettings;
}

export const DEFAULT_SETTINGS: CollageSettings = {
  rowHeight: 400,
  gap: 16,
  padding: 32,
  background: '#ffffff',
  exportFormat: 'png',
  jpegQuality: 0.92,
};

let state: CollageState = {
  items: [],
  canvasWidth: 0,
  canvasHeight: 0,
  settings: { ...DEFAULT_SETTINGS },
  selectedId: null,
};
const bitmaps = new Map<string, ImageBitmap>();
let history: Snapshot[] = [];
let historyIndex = -1;
let layoutDirty = false;
let nextId = 1;
const listeners = new Set<() => void>();

export function getState(): CollageState {
  return state;
}
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(): void {
  listeners.forEach((fn) => fn());
}
function set(patch: Partial<CollageState>): void {
  state = { ...state, ...patch };
}

function snapshot(): Snapshot {
  return {
    items: state.items.map((i) => ({
      id: i.id,
      x: i.x,
      y: i.y,
      width: i.width,
      height: i.height,
      naturalWidth: i.naturalWidth,
      naturalHeight: i.naturalHeight,
    })),
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    settings: { ...state.settings },
  };
}

function collectGarbage(): void {
  const used = new Set<string>();
  state.items.forEach((i) => used.add(i.id));
  history.forEach((s) => s.items.forEach((i) => used.add(i.id)));
  for (const [id, bmp] of bitmaps) {
    if (!used.has(id)) {
      bmp.close();
      bitmaps.delete(id);
    }
  }
}

function pushHistory(): void {
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot());
  if (history.length > HISTORY_LIMIT + 1) history.shift();
  historyIndex = history.length - 1;
  collectGarbage();
}

function commit(): void {
  pushHistory();
  emit();
}

function clampItem<T extends { x: number; y: number; width: number; height: number }>(
  r: T,
  cw: number,
  ch: number,
): T {
  const x = Math.max(0, Math.min(r.x, cw - r.width));
  const y = Math.max(0, Math.min(r.y, ch - r.height));
  return { ...r, x, y };
}
export function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const c = clampItem({ x, y, width, height }, state.canvasWidth, state.canvasHeight);
  return { x: c.x, y: c.y };
}

function updateItem(id: string, patch: Partial<CollageItem>): void {
  set({ items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
}

export function isLayoutDirty(): boolean {
  return layoutDirty && state.items.length > 0;
}

export function addImages(newBitmaps: ImageBitmap[]): void {
  if (newBitmaps.length === 0) return;
  const created: CollageItem[] = newBitmaps.map((source) => {
    const id = `img-${nextId++}`;
    bitmaps.set(id, source);
    return {
      id,
      source,
      naturalWidth: source.width,
      naturalHeight: source.height,
      x: 0,
      y: 0,
      width: source.width,
      height: source.height,
    };
  });
  if (state.items.length === 0) {
    const rowHeight = defaultRowHeight(
      created.map((i) => ({ width: i.naturalWidth, height: i.naturalHeight })),
    );
    set({ settings: { ...state.settings, rowHeight } });
    set({ items: created });
    applyLayout(false);
  } else {
    const { rowHeight, gap, padding } = state.settings;
    let x = Math.max(...state.items.map((i) => i.x + i.width)) + gap;
    const placed = created.map((i) => {
      const width = Math.max(1, Math.round((rowHeight * i.naturalWidth) / i.naturalHeight));
      const p = { ...i, x, y: padding, width, height: rowHeight };
      x += width + gap;
      return p;
    });
    set({
      items: [...state.items, ...placed],
      canvasWidth: Math.max(state.canvasWidth, x - gap + padding),
      canvasHeight: Math.max(state.canvasHeight, padding * 2 + rowHeight),
    });
  }
  set({ selectedId: created[created.length - 1].id });
  commit();
}

function applyLayout(sortByX: boolean): void {
  const ordered = sortByX ? [...state.items].sort((a, b) => a.x - b.x) : state.items;
  const res = layoutRow(
    ordered.map((i) => ({ width: i.naturalWidth, height: i.naturalHeight })),
    state.settings,
  );
  const geom = new Map<string, number>();
  ordered.forEach((it, idx) => geom.set(it.id, idx));
  set({
    items: state.items.map((i) => ({ ...i, ...res.items[geom.get(i.id) as number] })),
    canvasWidth: res.canvasWidth,
    canvasHeight: res.canvasHeight,
  });
  layoutDirty = false;
}

export function arrangeInRow(): void {
  if (state.items.length === 0) return;
  applyLayout(true);
  commit();
}

export function fitCanvas(): void {
  if (state.items.length === 0) return;
  const { padding } = state.settings;
  const minX = Math.min(...state.items.map((i) => i.x));
  const minY = Math.min(...state.items.map((i) => i.y));
  const maxX = Math.max(...state.items.map((i) => i.x + i.width));
  const maxY = Math.max(...state.items.map((i) => i.y + i.height));
  const dx = padding - minX;
  const dy = padding - minY;
  set({
    items: state.items.map((i) => ({ ...i, x: i.x + dx, y: i.y + dy })),
    canvasWidth: maxX - minX + padding * 2,
    canvasHeight: maxY - minY + padding * 2,
  });
  commit();
}

export function updateSettings(patch: Partial<CollageSettings>): void {
  const old = state.settings;
  const next = { ...old, ...patch };
  next.jpegQuality = Math.min(1, Math.max(0.5, next.jpegQuality));
  set({ settings: next });
  const layoutChanged =
    next.rowHeight !== old.rowHeight || next.gap !== old.gap || next.padding !== old.padding;
  if (layoutChanged && state.items.length > 0) applyLayout(true);
  commit();
}

export function select(id: string | null): void {
  if (state.selectedId === id) return;
  set({ selectedId: id });
  emit();
}

export function moveItem(id: string, x: number, y: number): void {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  updateItem(id, clampPosition(x, y, it.width, it.height));
  layoutDirty = true;
  commit();
}

export function resizeItem(id: string, x: number, y: number, width: number, height: number): void {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  const k = MIN_ITEM_SIDE / Math.min(width, height);
  const w = k > 1 ? width * k : width;
  const h = k > 1 ? height * k : height;
  updateItem(id, { width: w, height: h, ...clampPosition(x, y, w, h) });
  layoutDirty = true;
  commit();
}

export function nudgeSelected(dx: number, dy: number): void {
  const it = state.items.find((i) => i.id === state.selectedId);
  if (it) moveItem(it.id, it.x + dx, it.y + dy);
}

export function deleteSelected(): void {
  if (!state.selectedId) return;
  const id = state.selectedId;
  set({ items: state.items.filter((i) => i.id !== id), selectedId: null });
  commit();
}

export function reorderSelected(where: 'front' | 'back'): void {
  const it = state.items.find((i) => i.id === state.selectedId);
  if (!it) return;
  const rest = state.items.filter((i) => i.id !== it.id);
  set({ items: where === 'front' ? [...rest, it] : [it, ...rest] });
  commit();
}

function restore(s: Snapshot): void {
  const items: CollageItem[] = [];
  for (const g of s.items) {
    const source = bitmaps.get(g.id);
    if (source) items.push({ ...g, source });
  }
  set({
    items,
    canvasWidth: s.canvasWidth,
    canvasHeight: s.canvasHeight,
    settings: { ...s.settings },
    selectedId: items.some((i) => i.id === state.selectedId) ? state.selectedId : null,
  });
  layoutDirty = items.length > 0;
  emit();
}

export function canUndo(): boolean {
  return historyIndex > 0;
}
export function canRedo(): boolean {
  return historyIndex < history.length - 1;
}
export function undo(): void {
  if (!canUndo()) return;
  historyIndex--;
  restore(history[historyIndex]);
}
export function redo(): void {
  if (!canRedo()) return;
  historyIndex++;
  restore(history[historyIndex]);
}

history = [snapshot()];
historyIndex = 0;
