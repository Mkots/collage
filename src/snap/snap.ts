import type { Rect } from '../types';

export interface Guide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}
export interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}
export interface SnapOptions {
  threshold: number;
  gap: number;
  padding?: number;
}

type Kind = 'any' | 'start-only' | 'end-only';
interface Target {
  pos: number;
  kind: Kind;
  other: Rect | null;
}
interface Axis {
  start(r: Rect): number;
  size(r: Rect): number;
}
interface Hit {
  delta: number;
  position: number;
  other: Rect | null;
}

const X: Axis = { start: (r) => r.x, size: (r) => r.width };
const Y: Axis = { start: (r) => r.y, size: (r) => r.height };

function findSnap(
  moving: Rect,
  others: Rect[],
  canvasSize: number,
  opts: SnapOptions,
  a: Axis,
): Hit | null {
  const s = a.start(moving);
  const sz = a.size(moving);
  const edges = [s, s + sz / 2, s + sz];
  const targets: Target[] = [];
  for (const o of others) {
    const os = a.start(o);
    const osz = a.size(o);
    targets.push({ pos: os, kind: 'any', other: o });
    targets.push({ pos: os + osz / 2, kind: 'any', other: o });
    targets.push({ pos: os + osz, kind: 'any', other: o });
    targets.push({ pos: os + osz + opts.gap, kind: 'start-only', other: o });
    targets.push({ pos: os - opts.gap, kind: 'end-only', other: o });
  }
  const pad = opts.padding ?? 0;
  for (const p of [0, pad, canvasSize / 2, canvasSize - pad, canvasSize]) {
    targets.push({ pos: p, kind: 'any', other: null });
  }
  let best: Hit | null = null;
  for (const t of targets) {
    for (let i = 0; i < 3; i++) {
      if (t.kind === 'start-only' && i !== 0) continue;
      if (t.kind === 'end-only' && i !== 2) continue;
      const d = t.pos - edges[i];
      if (Math.abs(d) <= opts.threshold && (!best || Math.abs(d) < Math.abs(best.delta))) {
        best = { delta: d, position: t.pos, other: t.other };
      }
    }
  }
  return best;
}

function makeGuide(
  orientation: Guide['orientation'],
  hit: Hit,
  finalMoving: Rect,
  cross: Axis,
  crossCanvas: number,
): Guide {
  if (!hit.other) return { orientation, position: hit.position, start: 0, end: crossCanvas };
  const m0 = cross.start(finalMoving);
  const o0 = cross.start(hit.other);
  return {
    orientation,
    position: hit.position,
    start: Math.min(m0, o0),
    end: Math.max(m0 + cross.size(finalMoving), o0 + cross.size(hit.other)),
  };
}

export function computeSnap(
  moving: Rect,
  others: Rect[],
  canvas: { width: number; height: number },
  opts: SnapOptions,
): SnapResult {
  const hx = findSnap(moving, others, canvas.width, opts, X);
  const hy = findSnap(moving, others, canvas.height, opts, Y);
  const x = moving.x + (hx?.delta ?? 0);
  const y = moving.y + (hy?.delta ?? 0);
  const final: Rect = { ...moving, x, y };
  const guides: Guide[] = [];
  if (hx) guides.push(makeGuide('vertical', hx, final, Y, canvas.height));
  if (hy) guides.push(makeGuide('horizontal', hy, final, X, canvas.width));
  return { x, y, guides };
}
