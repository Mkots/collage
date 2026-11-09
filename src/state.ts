import {
  defaultRowHeight,
  insertionIndex,
  layoutRow,
  orientedSize,
  rowHeightForHeight,
  rowHeightForWidth,
} from './layout/row';
import type { CollageItem, CollageSettings, CollageState, LayoutMode, Orientation } from './types';

const HISTORY_LIMIT = 50;
export const MIN_ITEM_SIDE = 40;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;
export const MAX_PAN = 1;
export const MIN_ROW_HEIGHT = 40;
export const MAX_ROW_HEIGHT = 4000;

interface ItemGeom {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  orientation: Orientation;
  zoom: number;
  rotation: number;
  panX: number;
  panY: number;
}
interface Snapshot {
  items: ItemGeom[];
  canvasWidth: number;
  canvasHeight: number;
  settings: CollageSettings;
}

export const DEFAULT_SETTINGS: CollageSettings = {
  layoutMode: 'row',
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
      orientation: i.orientation,
      zoom: i.zoom,
      rotation: i.rotation,
      panX: i.panX,
      panY: i.panY,
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

function isRow(): boolean {
  return state.settings.layoutMode === 'row';
}

/** Displayed (oriented) size of an item's photo. */
export function displaySize(i: CollageItem): { width: number; height: number } {
  return orientedSize({ width: i.naturalWidth, height: i.naturalHeight }, i.orientation);
}

/** Items in left-to-right order (by frame centre). */
export function rowOrder(items: CollageItem[] = state.items): CollageItem[] {
  return [...items].sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2) || a.y - b.y);
}

/** Lays the items out in one row in the given order. */
function layoutOrdered(ordered: CollageItem[]): void {
  const res = layoutRow(ordered.map(displaySize), state.settings);
  const geom = new Map<string, number>();
  ordered.forEach((it, idx) => geom.set(it.id, idx));
  set({
    items: state.items.map((i) => {
      const idx = geom.get(i.id);
      return idx === undefined ? i : { ...i, ...res.items[idx] };
    }),
    canvasWidth: res.canvasWidth,
    canvasHeight: res.canvasHeight,
  });
}

/** In row mode, re-flows the row keeping the current left-to-right order. */
function reflow(): void {
  if (isRow() && state.items.length > 0) layoutOrdered(rowOrder());
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
      orientation: 0,
      x: 0,
      y: 0,
      width: source.width,
      height: source.height,
      zoom: 1,
      rotation: 0,
      panX: 0,
      panY: 0,
    };
  });
  if (state.items.length === 0) {
    const rowHeight = defaultRowHeight(created.map(displaySize));
    set({ settings: { ...state.settings, rowHeight }, items: created });
    layoutOrdered(created);
  } else if (isRow()) {
    const ordered = [...rowOrder(), ...created];
    set({ items: [...state.items, ...created] });
    layoutOrdered(ordered);
  } else {
    const { rowHeight, gap, padding } = state.settings;
    let x = Math.max(...state.items.map((i) => i.x + i.width)) + gap;
    const placed = created.map((i) => {
      const d = displaySize(i);
      const width = Math.max(1, Math.round((rowHeight * d.width) / d.height));
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
  set({ selectedId: null });
  commit();
}

/** Switches between the automatic row layout and free placement. */
export function setLayoutMode(mode: LayoutMode): void {
  if (state.settings.layoutMode === mode) return;
  set({ settings: { ...state.settings, layoutMode: mode } });
  reflow();
  commit();
}

/** Lays all images out in one row (switches to row mode). */
export function arrangeInRow(): void {
  if (state.items.length === 0) return;
  if (isRow()) {
    reflow();
    commit();
  } else setLayoutMode('row');
}

export function fitCanvas(): void {
  if (state.items.length === 0) return;
  if (isRow()) {
    reflow();
    commit();
    return;
  }
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

const clampRowHeight = (h: number): number =>
  Math.round(Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, h)));

export function updateSettings(patch: Partial<CollageSettings>): void {
  const next = { ...state.settings, ...patch };
  next.jpegQuality = Math.min(1, Math.max(0.5, next.jpegQuality));
  next.rowHeight = clampRowHeight(next.rowHeight);
  next.gap = Math.max(0, next.gap);
  next.padding = Math.max(0, next.padding);
  set({ settings: next });
  reflow();
  commit();
}

export const MIN_CANVAS = 50;
export const MAX_CANVAS = 20000;

/**
 * Sets the canvas size. In row mode the row height is chosen so the row fills the requested
 * width (or height, if only the height changed); in free mode items are kept inside the bounds.
 */
export function setCanvasSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  const cw = Math.round(Math.min(MAX_CANVAS, Math.max(MIN_CANVAS, width)));
  const ch = Math.round(Math.min(MAX_CANVAS, Math.max(MIN_CANVAS, height)));
  if (cw === state.canvasWidth && ch === state.canvasHeight) return;
  if (isRow() && state.items.length > 0) {
    const { gap, padding } = state.settings;
    const rowHeight =
      cw !== state.canvasWidth
        ? rowHeightForWidth(state.items.map(displaySize), cw, gap, padding)
        : rowHeightForHeight(ch, padding);
    updateSettings({ rowHeight });
    return;
  }
  set({
    canvasWidth: cw,
    canvasHeight: ch,
    items: state.items.map((i) => ({ ...i, ...clampItem(i, cw, ch) })),
  });
  commit();
}

/** Rotates an item by a multiple of 90° clockwise: the frame turns with the photo, no cropping. */
function turned(i: CollageItem, deg: number): CollageItem {
  const q = ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Orientation;
  if (q === 0) return i;
  const orientation = ((i.orientation + q) % 360) as Orientation;
  const [panX, panY] =
    q === 90 ? [-i.panY, i.panX] : q === 270 ? [i.panY, -i.panX] : [-i.panX, -i.panY];
  const next = { ...i, orientation, panX: panX || 0, panY: panY || 0 };
  if (q === 180 || isRow()) return next;
  // Free mode: swap the frame's sides around its centre, shrinking it if it no longer fits.
  const k = Math.min(1, state.canvasWidth / i.height, state.canvasHeight / i.width);
  const width = i.height * k;
  const height = i.width * k;
  const x = i.x + i.width / 2 - width / 2;
  const y = i.y + i.height / 2 - height / 2;
  return { ...next, ...clampItem({ x, y, width, height }, state.canvasWidth, state.canvasHeight) };
}

/** Rotates one photo by `deg` (a multiple of 90) without cropping it. */
export function rotateItem(id: string, deg: number): void {
  if (!state.items.some((i) => i.id === id)) return;
  const order = rowOrder().map((i) => i.id);
  set({ items: state.items.map((i) => (i.id === id ? turned(i, deg) : i)) });
  reorderRow(order);
  commit();
}

/** Rotates every photo by `deg` (a multiple of 90) without cropping, in one history step. */
export function rotateAll(deg: number): void {
  if (state.items.length === 0) return;
  const order = rowOrder().map((i) => i.id);
  set({ items: state.items.map((i) => turned(i, deg)) });
  reorderRow(order);
  commit();
}

function reorderRow(ids: string[]): void {
  if (!isRow()) return;
  const byId = new Map(state.items.map((i) => [i.id, i]));
  layoutOrdered(ids.map((id) => byId.get(id)).filter((i): i is CollageItem => !!i));
}

/** Row mode: moves an item to the slot nearest to `centerX` and re-flows the row. */
export function dropInRow(id: string, centerX: number): void {
  const it = state.items.find((i) => i.id === id);
  if (!it || !isRow()) return;
  const others = rowOrder().filter((i) => i.id !== id);
  const idx = insertionIndex(
    others.map((o) => o.x + o.width / 2),
    centerX,
  );
  others.splice(idx, 0, it);
  layoutOrdered(others);
  commit();
}

/** Row mode: moves an item one slot left (-1) or right (+1). */
export function shiftInRow(id: string, dir: -1 | 1): void {
  if (!isRow()) return;
  const order = rowOrder();
  const from = order.findIndex((i) => i.id === id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  layoutOrdered(order);
  commit();
}

/** Removes all images (undoable). */
export function clearAll(): void {
  if (state.items.length === 0) return;
  set({ items: [], selectedId: null, canvasWidth: 0, canvasHeight: 0 });
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
  if (isRow()) {
    dropInRow(id, x + it.width / 2);
    return;
  }
  updateItem(id, clampPosition(x, y, it.width, it.height));
  commit();
}

export function resizeItem(id: string, x: number, y: number, width: number, height: number): void {
  const it = state.items.find((i) => i.id === id);
  if (!it || isRow()) return;
  const k = MIN_ITEM_SIDE / Math.min(width, height);
  const w = k > 1 ? width * k : width;
  const h = k > 1 ? height * k : height;
  updateItem(id, { width: w, height: h, ...clampPosition(x, y, w, h) });
  commit();
}

export function normalizeRotation(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

export interface ItemView {
  zoom?: number;
  rotation?: number;
  panX?: number;
  panY?: number;
}

let viewPending = false;

/**
 * Sets zoom, rotation and/or pan of an item's content; the frame stays in place and overflow is
 * cropped. With `record: false` (live slider dragging) no history entry is made until
 * `commitView()` is called.
 */
export function setItemView(id: string, view: ItemView, record = true): void {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
  const next = {
    zoom: view.zoom === undefined ? it.zoom : clamp(view.zoom, MIN_ZOOM, MAX_ZOOM),
    rotation: view.rotation === undefined ? it.rotation : normalizeRotation(view.rotation),
    panX: view.panX === undefined ? it.panX : clamp(view.panX, -MAX_PAN, MAX_PAN),
    panY: view.panY === undefined ? it.panY : clamp(view.panY, -MAX_PAN, MAX_PAN),
  };
  if (!Object.values(next).every(Number.isFinite)) return;
  const changed = (Object.keys(next) as (keyof typeof next)[]).some((k) => next[k] !== it[k]);
  if (changed) updateItem(id, next);
  if (record && (changed || viewPending)) {
    viewPending = false;
    commit();
  } else if (changed) {
    viewPending = true;
    emit();
  }
}

/** Records a history entry for live (`record: false`) view changes. */
export function commitView(): void {
  if (!viewPending) return;
  viewPending = false;
  commit();
}

export function nudgeSelected(dx: number, dy: number): void {
  const it = state.items.find((i) => i.id === state.selectedId);
  if (!it) return;
  if (isRow()) {
    if (dx !== 0) shiftInRow(it.id, dx < 0 ? -1 : 1);
    return;
  }
  moveItem(it.id, it.x + dx, it.y + dy);
}

/** Rotates the selected photo by `deg` (a multiple of 90) without cropping. */
export function rotateSelected(deg: number): void {
  if (state.selectedId) rotateItem(state.selectedId, deg);
}

export function deleteSelected(): void {
  if (!state.selectedId) return;
  const id = state.selectedId;
  set({ items: state.items.filter((i) => i.id !== id), selectedId: null });
  if (state.items.length === 0) set({ canvasWidth: 0, canvasHeight: 0 });
  reflow();
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
