import {
  arrangeInRow,
  canRedo,
  canUndo,
  deleteSelected,
  fitCanvas,
  getState,
  isLayoutDirty,
  redo,
  reorderSelected,
  subscribe,
  undo,
  updateSettings,
} from '../state';
import type { CollageSettings } from '../types';

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
  root.append(add, arrange, fit, settingsBtn, undoBtn, redoBtn, front, back, del, download);

  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Settings');
  const rowHeight = field(panel, 'Row height', 'number', { min: '40', max: '4000' });
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
    undoBtn.disabled = !canUndo();
    redoBtn.disabled = !canRedo();
    arrange.disabled = fit.disabled = download.disabled = s.items.length === 0;
  }
  subscribe(sync);
  sync();
}
