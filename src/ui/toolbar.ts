import {
  MAX_CANVAS,
  MAX_ROW_HEIGHT,
  MIN_CANVAS,
  MIN_ROW_HEIGHT,
  canRedo,
  canUndo,
  fitCanvas,
  getState,
  redo,
  rotateAll,
  setCanvasSize,
  setLayoutMode,
  subscribe,
  undo,
  updateSettings,
} from '../state';
import type { LayoutMode } from '../types';
import { button, field, group, setValue } from './dom';

export interface ToolbarActions {
  addImages(): void;
  clear(): void;
  download(): void;
}

export function createToolbar(root: HTMLElement, actions: ToolbarActions): void {
  const add = button('Add photos', '＋ Add photos', actions.addImages, 'primary-soft');

  const rotAllL = button('Rotate all photos 90° left', '⟲ All', () => rotateAll(-90));
  const rotAllR = button('Rotate all photos 90° right', '⟳ All', () => rotateAll(90));

  const modeBtn = (mode: LayoutMode, text: string, label: string): HTMLButtonElement => {
    const b = button(label, text, () => setLayoutMode(mode), 'segment');
    b.dataset.mode = mode;
    return b;
  };
  const rowBtn = modeBtn('row', 'Row', 'Row layout: photos in one row, drag to reorder');
  const freeBtn = modeBtn('free', 'Free', 'Free layout: move and resize photos anywhere');
  const segmented = group('Layout', rowBtn, freeBtn);
  segmented.classList.add('segmented');
  const fit = button('Fit canvas to content', 'Fit canvas', fitCanvas);

  const undoBtn = button('Undo', '↶', undo);
  const redoBtn = button('Redo', '↷', redo);
  const settingsBtn = button('Settings', '⚙ Settings', () => toggle());
  settingsBtn.setAttribute('aria-expanded', 'false');
  settingsBtn.setAttribute('aria-controls', 'settings-panel');
  const clear = button('Remove all photos', 'Clear', actions.clear);
  const download = button('Download', '⤓ Download', actions.download, 'primary');

  root.append(
    group('Photos', add),
    group('Rotate all', rotAllL, rotAllR),
    segmented,
    fit,
    group('History', undoBtn, redoBtn),
    group('More', settingsBtn, clear),
    download,
  );

  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Settings');
  const rowHeight = field(panel, 'Row height', 'number', {
    min: String(MIN_ROW_HEIGHT),
    max: String(MAX_ROW_HEIGHT),
  });
  const canvasW = field(panel, 'Width', 'number', {
    min: String(MIN_CANVAS),
    max: String(MAX_CANVAS),
  });
  const canvasH = field(panel, 'Height', 'number', {
    min: String(MIN_CANVAS),
    max: String(MAX_CANVAS),
  });
  const gap = field(panel, 'Gap', 'number', { min: '0', max: '500' });
  const padding = field(panel, 'Padding', 'number', { min: '0', max: '500' });
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

  function toggle(open = panel.hidden): void {
    panel.hidden = !open;
    settingsBtn.setAttribute('aria-expanded', String(open));
    if (open) canvasW.focus();
    else settingsBtn.focus();
  }
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggle(false);
  });

  const num = (el: HTMLInputElement): number => Number(el.value);
  const valid = (el: HTMLInputElement, min: number): boolean =>
    el.value !== '' && Number.isFinite(num(el)) && num(el) >= min;
  rowHeight.addEventListener('change', () =>
    valid(rowHeight, MIN_ROW_HEIGHT) ? updateSettings({ rowHeight: num(rowHeight) }) : sync(),
  );
  gap.addEventListener('change', () =>
    valid(gap, 0) ? updateSettings({ gap: num(gap) }) : sync(),
  );
  padding.addEventListener('change', () =>
    valid(padding, 0) ? updateSettings({ padding: num(padding) }) : sync(),
  );
  const canvasChange = (): void => {
    if (valid(canvasW, MIN_CANVAS) && valid(canvasH, MIN_CANVAS))
      setCanvasSize(num(canvasW), num(canvasH));
    sync();
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
    valid(quality, 0.5) ? updateSettings({ jpegQuality: num(quality) }) : sync(),
  );

  function sync(): void {
    const s = getState();
    const st = s.settings;
    const row = st.layoutMode === 'row';
    const empty = s.items.length === 0;
    setValue(rowHeight, String(Math.round(st.rowHeight)));
    setValue(canvasW, String(Math.round(s.canvasWidth)));
    setValue(canvasH, String(Math.round(s.canvasHeight)));
    setValue(gap, String(st.gap));
    setValue(padding, String(st.padding));
    if (st.background !== 'transparent' && /^#[0-9a-f]{6}$/i.test(st.background))
      setValue(bg, st.background);
    transparent.checked = st.background === 'transparent';
    format.value = st.exportFormat;
    setValue(quality, String(st.jpegQuality));
    quality.disabled = st.exportFormat !== 'jpeg';
    rowHeight.disabled = !row;
    canvasW.disabled = canvasH.disabled = empty;
    canvasW.title = row ? 'Row height is adjusted so the collage gets this width' : '';
    canvasH.title = row ? 'Row height is adjusted so the collage gets this height' : '';

    for (const b of [rowBtn, freeBtn])
      b.setAttribute('aria-pressed', String(b.dataset.mode === st.layoutMode));
    fit.hidden = row;
    rotAllL.disabled = rotAllR.disabled = empty;
    undoBtn.disabled = !canUndo();
    redoBtn.disabled = !canRedo();
    fit.disabled = clear.disabled = download.disabled = empty;
  }
  subscribe(sync);
  sync();
}
