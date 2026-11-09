import {
  MAX_PAN,
  MAX_ZOOM,
  MIN_ZOOM,
  arrangeInRow,
  commitView,
  canRedo,
  canUndo,
  deleteSelected,
  fitCanvas,
  getState,
  isLayoutDirty,
  redo,
  rotateAll,
  setCanvasSize,
  MIN_CANVAS,
  MAX_CANVAS,
  reorderSelected,
  setItemView,
  subscribe,
  undo,
  updateSettings,
} from '../state';
import type { ItemView } from '../state';
import type { CollageItem, CollageSettings } from '../types';

const CONFIRM_MSG = 'This will reset the positions and sizes of all images. Continue?';

function button(
  label: string,
  text: string,
  onClick: () => void,
  primary = false,
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.title = label;
  if (primary) b.classList.add('primary');
  b.addEventListener('click', onClick);
  return b;
}

function field(
  panel: HTMLElement,
  label: string,
  type: string,
  attrs: Record<string, string> = {},
): HTMLInputElement {
  const l = document.createElement('label');
  l.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  Object.entries(attrs).forEach(([k, v]) => input.setAttribute(k, v));
  l.appendChild(input);
  panel.appendChild(l);
  return input;
}

export interface ToolbarActions {
  addImages(): void;
  download(): void;
}

export function createToolbar(root: HTMLElement, actions: ToolbarActions): void {
  const add = button('Add images', 'Add images', actions.addImages);
  const arrange = button('Arrange in row', 'Arrange in row', () => {
    if (isLayoutDirty() && !window.confirm(CONFIRM_MSG)) return;
    arrangeInRow();
  });
  const fit = button('Fit canvas to content', 'Fit canvas', fitCanvas);
  const settingsBtn = button('Settings', 'Settings', () => toggle());
  settingsBtn.setAttribute('aria-expanded', 'false');
  settingsBtn.setAttribute('aria-controls', 'settings-panel');
  const undoBtn = button('Undo', 'Undo', undo);
  const redoBtn = button('Redo', 'Redo', redo);
  const front = button('Bring to front', 'To front', () => reorderSelected('front'));
  const back = button('Send to back', 'To back', () => reorderSelected('back'));
  const del = button('Delete', 'Delete', deleteSelected);
  const download = button('Download', 'Download', actions.download, true);
  const rotL = button('Rotate image 90° left', '⟲', () => rotateBy(-90));
  const rotR = button('Rotate image 90° right', '⟳', () => rotateBy(90));
  const zoomIn = button('Zoom image in', '＋', () => zoomBy(1.1));
  const zoomOut = button('Zoom image out', '－', () => zoomBy(1 / 1.1));
  const rotAllL = button('Rotate all images 90° left', 'All ⟲', () => rotateAll(-90));
  const rotAllR = button('Rotate all images 90° right', 'All ⟳', () => rotateAll(90));
  const resetView = button('Reset image zoom and rotation', 'Reset view', () => {
    const id = getState().selectedId;
    if (id) setItemView(id, { zoom: 1, rotation: 0, panX: 0, panY: 0 });
  });
  const viewLabel = document.createElement('span');
  viewLabel.className = 'view-label';
  viewLabel.setAttribute('aria-live', 'off');
  root.append(add, arrange, fit, settingsBtn, undoBtn, redoBtn, front, back, del);
  root.append(zoomOut, zoomIn, rotL, rotR, rotAllL, rotAllR, resetView, viewLabel, download);

  function selectedItem(): CollageItem | undefined {
    const s = getState();
    return s.items.find((i) => i.id === s.selectedId);
  }
  function rotateBy(deg: number): void {
    const it = selectedItem();
    if (it) setItemView(it.id, { rotation: it.rotation + deg });
  }
  function zoomBy(k: number): void {
    const it = selectedItem();
    if (it) setItemView(it.id, { zoom: it.zoom * k });
  }

  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Settings');
  const rowHeight = field(panel, 'Row height', 'number', { min: '40', max: '4000' });
  const gap = field(panel, 'Gap', 'number', { min: '0', max: '500' });
  const padding = field(panel, 'Padding', 'number', { min: '0', max: '500' });
  const canvasW = field(panel, 'Canvas width', 'number', {
    min: String(MIN_CANVAS),
    max: String(MAX_CANVAS),
  });
  const canvasH = field(panel, 'Canvas height', 'number', {
    min: String(MIN_CANVAS),
    max: String(MAX_CANVAS),
  });
  const bg = field(panel, 'Background', 'color');
  const transparent = field(panel, 'Transparent', 'checkbox');
  const format = document.createElement('select');
  format.innerHTML = '<option value="png">PNG</option><option value="jpeg">JPEG</option>';
  const fl = document.createElement('label');
  fl.textContent = 'Export format';
  fl.appendChild(format);
  panel.appendChild(fl);
  const quality = field(panel, 'JPEG quality', 'number', { min: '0.5', max: '1', step: '0.01' });
  root.after(panel);

  // Per-image view panel: free rotation, zoom and pan (visible while an image is selected).
  const viewPanel = document.createElement('div');
  viewPanel.id = 'view-panel';
  viewPanel.hidden = true;
  viewPanel.setAttribute('role', 'group');
  viewPanel.setAttribute('aria-label', 'Selected image framing');
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
    l.append(range, num);
    viewPanel.appendChild(l);
    return { range, num };
  };
  const { range: rotRange, num: rotNum } = pair(
    'Rotation °',
    { min: '-180', max: '180', step: '0.5' },
    { min: '-180', max: '180', step: '0.1' },
  );
  const { range: zoomRange, num: zoomNum } = pair(
    'Zoom %',
    { min: String(Math.log(MIN_ZOOM)), max: String(Math.log(MAX_ZOOM)), step: 'any' },
    { min: String(MIN_ZOOM * 100), max: String(MAX_ZOOM * 100), step: '1' },
  );
  const { range: panYRange, num: panYNum } = pair(
    'Vertical %',
    { min: String(-MAX_PAN * 100), max: String(MAX_PAN * 100), step: '0.5' },
    { min: String(-MAX_PAN * 100), max: String(MAX_PAN * 100), step: '0.5' },
  );
  const { range: panXRange, num: panXNum } = pair(
    'Horizontal %',
    { min: String(-MAX_PAN * 100), max: String(MAX_PAN * 100), step: '0.5' },
    { min: String(-MAX_PAN * 100), max: String(MAX_PAN * 100), step: '0.5' },
  );
  panel.after(viewPanel);

  function setView(el: HTMLInputElement, v: number): void {
    if (el !== document.activeElement) el.value = String(v);
  }
  function bindView(
    range: HTMLInputElement,
    num: HTMLInputElement,
    toView: (v: number) => ItemView,
    fromRange: (v: number) => number = (v) => v,
  ): void {
    range.addEventListener('input', () => {
      const it = selectedItem();
      if (it) setItemView(it.id, toView(fromRange(Number(range.value))), false);
    });
    range.addEventListener('change', commitView);
    num.addEventListener('change', () => {
      const it = selectedItem();
      if (it && num.value !== '' && Number.isFinite(Number(num.value)))
        setItemView(it.id, toView(Number(num.value)));
      else sync();
    });
  }
  bindView(rotRange, rotNum, (v) => ({ rotation: v }));
  bindView(
    zoomRange,
    zoomNum,
    (v) => ({ zoom: v / 100 }),
    (v) => Math.exp(v) * 100,
  );
  bindView(panYRange, panYNum, (v) => ({ panY: v / 100 }));
  bindView(panXRange, panXNum, (v) => ({ panX: v / 100 }));

  function toggle(open = panel.hidden): void {
    panel.hidden = !open;
    settingsBtn.setAttribute('aria-expanded', String(open));
    if (open) rowHeight.focus();
    else settingsBtn.focus();
  }
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggle(false);
  });

  const layoutChange = (patch: Partial<CollageSettings>): void => {
    if (isLayoutDirty() && !window.confirm(CONFIRM_MSG)) {
      sync();
      return;
    }
    updateSettings(patch);
  };
  const num = (el: HTMLInputElement): number => Number(el.value);
  const positive = (el: HTMLInputElement, min: number): boolean =>
    Number.isFinite(num(el)) && num(el) >= min;
  rowHeight.addEventListener('change', () =>
    positive(rowHeight, 40) ? layoutChange({ rowHeight: num(rowHeight) }) : sync(),
  );
  gap.addEventListener('change', () =>
    positive(gap, 0) ? layoutChange({ gap: num(gap) }) : sync(),
  );
  padding.addEventListener('change', () =>
    positive(padding, 0) ? layoutChange({ padding: num(padding) }) : sync(),
  );
  const canvasChange = (): void => {
    if (positive(canvasW, MIN_CANVAS) && positive(canvasH, MIN_CANVAS))
      setCanvasSize(num(canvasW), num(canvasH));
    else sync();
  };
  canvasW.addEventListener('change', canvasChange);
  canvasH.addEventListener('change', canvasChange);
  bg.addEventListener('input', () => {
    transparent.checked = false;
    updateSettings({ background: bg.value });
  });
  transparent.addEventListener('change', () =>
    updateSettings({ background: transparent.checked ? 'transparent' : bg.value }),
  );
  format.addEventListener('change', () =>
    updateSettings({ exportFormat: format.value === 'jpeg' ? 'jpeg' : 'png' }),
  );
  quality.addEventListener('change', () =>
    positive(quality, 0.5) ? updateSettings({ jpegQuality: num(quality) }) : sync(),
  );

  function sync(): void {
    const s = getState();
    const st = s.settings;
    const active = document.activeElement;
    const set = (el: HTMLInputElement, v: string): void => {
      if (el !== active) el.value = v;
    };
    set(rowHeight, String(Math.round(st.rowHeight)));
    set(canvasW, String(Math.round(s.canvasWidth)));
    set(canvasH, String(Math.round(s.canvasHeight)));
    set(gap, String(st.gap));
    set(padding, String(st.padding));
    if (st.background !== 'transparent' && /^#[0-9a-f]{6}$/i.test(st.background))
      set(bg, st.background);
    transparent.checked = st.background === 'transparent';
    format.value = st.exportFormat;
    set(quality, String(st.jpegQuality));
    quality.disabled = st.exportFormat !== 'jpeg';
    const has = s.selectedId !== null;
    front.disabled = back.disabled = del.disabled = !has;
    const sel = selectedItem();
    zoomIn.disabled = !sel || sel.zoom >= MAX_ZOOM;
    zoomOut.disabled = !sel || sel.zoom <= MIN_ZOOM;
    rotL.disabled = rotR.disabled = !sel;
    rotAllL.disabled = rotAllR.disabled = s.items.length === 0;
    resetView.disabled =
      !sel || (sel.zoom === 1 && sel.rotation === 0 && sel.panX === 0 && sel.panY === 0);
    viewPanel.hidden = !sel;
    if (sel) {
      const zoomPct = Math.round(sel.zoom * 100);
      setView(zoomRange, Math.log(sel.zoom));
      setView(zoomNum, zoomPct);
      setView(rotRange, sel.rotation);
      setView(rotNum, Math.round(sel.rotation * 10) / 10);
      setView(panYRange, sel.panY * 100);
      setView(panYNum, Math.round(sel.panY * 1000) / 10);
      setView(panXRange, sel.panX * 100);
      setView(panXNum, Math.round(sel.panX * 1000) / 10);
    }
    viewLabel.textContent = sel
      ? `${Math.round(sel.zoom * 100)}% · ${Math.round(sel.rotation)}°`
      : '';
    undoBtn.disabled = !canUndo();
    redoBtn.disabled = !canRedo();
    arrange.disabled = fit.disabled = download.disabled = s.items.length === 0;
  }
  subscribe(sync);
  sync();
}
