import './styles.css';
import { createStage } from './canvas/stage';
import { exportCollage } from './io/export';
import { setupImport } from './io/import';
import {
  addImages,
  deleteSelected,
  getState,
  nudgeSelected,
  redo,
  select,
  subscribe,
  undo,
} from './state';
import { createToolbar } from './ui/toolbar';
import { showToast } from './ui/toast';

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing #${id}`);
  return e as T;
}

const container = el('canvas-container');
const input = el<HTMLInputElement>('file-input');
const emptyState = el('empty-state');
const status = el('status');
const stage = createStage(container);

const openDialog = (): void => input.click();
emptyState.addEventListener('click', openDialog);

createToolbar(el('toolbar'), {
  addImages: openDialog,
  download: () => {
    const s = getState();
    exportCollage(
      stage,
      { width: s.canvasWidth, height: s.canvasHeight },
      s.settings,
      showToast,
    ).catch(() => showToast('Export failed'));
  },
});
setupImport(input, el('drop-overlay'), addImages);

function updateStatus(): void {
  const s = getState();
  emptyState.hidden = s.items.length > 0;
  status.textContent =
    s.items.length === 0
      ? ''
      : `${Math.round(s.canvasWidth)} × ${Math.round(s.canvasHeight)} px · ${Math.round(stage.getScale() * 100)}%`;
}
subscribe(updateStatus);
new ResizeObserver(updateStatus).observe(container);
updateStatus();

window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t.matches('input, textarea, select')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (e.key === 'Escape') select(null);
  if (!getState().selectedId) return;
  const step = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case 'ArrowLeft':
      nudgeSelected(-step, 0);
      break;
    case 'ArrowRight':
      nudgeSelected(step, 0);
      break;
    case 'ArrowUp':
      nudgeSelected(0, -step);
      break;
    case 'ArrowDown':
      nudgeSelected(0, step);
      break;
    case 'Delete':
    case 'Backspace':
      deleteSelected();
      break;
    default:
      return;
  }
  e.preventDefault();
});

if (import.meta.env.MODE !== 'production' || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __collage: unknown }).__collage = {
    getState: () => ({
      items: getState().items.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
      scale: stage.getScale(),
    }),
  };
}
