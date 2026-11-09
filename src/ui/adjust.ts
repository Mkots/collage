import {
  MAX_PAN,
  MAX_ZOOM,
  MIN_ZOOM,
  commitView,
  getState,
  setItemView,
  subscribe,
} from '../state';
import type { ItemView } from '../state';
import type { CollageItem } from '../types';
import { button, setValue } from './dom';

export interface AdjustPanel {
  toggle(open?: boolean): void;
  isOpen(): boolean;
  onToggle(fn: () => void): void;
}

function selectedItem(): CollageItem | undefined {
  const s = getState();
  return s.items.find((i) => i.id === s.selectedId);
}

/**
 * "Crop & straighten" panel for the selected photo: zoom, fine rotation and shift of the photo
 * inside its frame (overflow is cropped). Hidden until opened from the photo's bar.
 */
export function createAdjustPanel(after: HTMLElement): AdjustPanel {
  let open = false;
  const toggleListeners: (() => void)[] = [];
  const panel = document.createElement('div');
  panel.id = 'view-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Crop and straighten selected photo');

  const title = document.createElement('strong');
  title.className = 'panel-title';
  title.textContent = 'Crop & straighten';
  panel.appendChild(title);

  const pair = (
    label: string,
    rangeAttrs: Record<string, string>,
    numAttrs: Record<string, string>,
  ): { range: HTMLInputElement; num: HTMLInputElement } => {
    const l = document.createElement('label');
    l.textContent = label;
    const range = document.createElement('input');
    range.type = 'range';
    Object.entries(rangeAttrs).forEach(([k, v]) => range.setAttribute(k, v));
    range.setAttribute('aria-label', label);
    const num = document.createElement('input');
    num.type = 'number';
    Object.entries(numAttrs).forEach(([k, v]) => num.setAttribute(k, v));
    num.setAttribute('aria-label', `${label} (value)`);
    const row = document.createElement('span');
    row.className = 'pair';
    row.append(range, num);
    l.append(row);
    panel.appendChild(l);
    return { range, num };
  };
  const zoom = pair(
    'Zoom %',
    { min: String(Math.log(1)), max: String(Math.log(MAX_ZOOM)), step: 'any' },
    { min: String(MIN_ZOOM * 100), max: String(MAX_ZOOM * 100), step: '1' },
  );
  const rot = pair(
    'Straighten °',
    { min: '-45', max: '45', step: '0.5' },
    { min: '-180', max: '180', step: '0.1' },
  );
  const panX = pair(
    'Horizontal %',
    { min: String(-MAX_PAN * 100), max: String(MAX_PAN * 100), step: '0.5' },
    { min: String(-MAX_PAN * 100), max: String(MAX_PAN * 100), step: '0.5' },
  );
  const panY = pair(
    'Vertical %',
    { min: String(-MAX_PAN * 100), max: String(MAX_PAN * 100), step: '0.5' },
    { min: String(-MAX_PAN * 100), max: String(MAX_PAN * 100), step: '0.5' },
  );
  const reset = button('Reset crop', 'Reset', () => {
    const it = selectedItem();
    if (it) setItemView(it.id, { zoom: 1, rotation: 0, panX: 0, panY: 0 });
  });
  const done = button('Close crop panel', 'Done', () => toggle(false), 'primary-soft');
  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  actions.append(reset, done);
  panel.appendChild(actions);
  after.after(panel);

  function bind(
    p: { range: HTMLInputElement; num: HTMLInputElement },
    toView: (v: number) => ItemView,
    fromRange: (v: number) => number = (v) => v,
  ): void {
    p.range.addEventListener('input', () => {
      const it = selectedItem();
      if (it) setItemView(it.id, toView(fromRange(Number(p.range.value))), false);
    });
    p.range.addEventListener('change', commitView);
    p.num.addEventListener('change', () => {
      const it = selectedItem();
      if (it && p.num.value !== '' && Number.isFinite(Number(p.num.value)))
        setItemView(it.id, toView(Number(p.num.value)));
      else sync();
    });
  }
  bind(
    zoom,
    (v) => ({ zoom: v / 100 }),
    (v) => Math.exp(v) * 100,
  );
  bind(rot, (v) => ({ rotation: v }));
  bind(panX, (v) => ({ panX: v / 100 }));
  bind(panY, (v) => ({ panY: v / 100 }));

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      toggle(false);
    }
  });

  function toggle(next = !open): void {
    open = next;
    sync();
    toggleListeners.forEach((fn) => fn());
  }

  function sync(): void {
    const sel = selectedItem();
    panel.hidden = !open || !sel;
    if (!sel) return;
    setValue(zoom.range, String(Math.log(Math.max(1, sel.zoom))));
    setValue(zoom.num, String(Math.round(sel.zoom * 100)));
    setValue(rot.range, String(sel.rotation));
    setValue(rot.num, String(Math.round(sel.rotation * 10) / 10));
    setValue(panX.range, String(sel.panX * 100));
    setValue(panX.num, String(Math.round(sel.panX * 1000) / 10));
    setValue(panY.range, String(sel.panY * 100));
    setValue(panY.num, String(Math.round(sel.panY * 1000) / 10));
    reset.disabled = sel.zoom === 1 && sel.rotation === 0 && sel.panX === 0 && sel.panY === 0;
  }
  subscribe(sync);
  sync();

  return {
    toggle,
    isOpen: () => open && !!selectedItem(),
    onToggle: (fn) => toggleListeners.push(fn),
  };
}
