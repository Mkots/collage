import type { StageHandle } from '../canvas/stage';
import {
  deleteSelected,
  getState,
  reorderSelected,
  rotateSelected,
  rowOrder,
  shiftInRow,
} from '../state';
import type { AdjustPanel } from './adjust';
import { button } from './dom';

/**
 * Small floating bar on top of the selected photo with the actions people need most:
 * rotate without cropping, move left/right in the row, crop, delete.
 */
export function createItemBar(
  workspace: HTMLElement,
  stage: StageHandle,
  adjust: AdjustPanel,
): void {
  const bar = document.createElement('div');
  bar.id = 'item-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Selected photo');
  bar.hidden = true;

  const selected = (): string | null => getState().selectedId;
  const rotL = button('Rotate photo 90° left', '⟲', () => rotateSelected(-90));
  const rotR = button('Rotate photo 90° right', '⟳', () => rotateSelected(90));
  const left = button('Move photo left', '◀', () => {
    const id = selected();
    if (id) shiftInRow(id, -1);
  });
  const right = button('Move photo right', '▶', () => {
    const id = selected();
    if (id) shiftInRow(id, 1);
  });
  const front = button('Bring to front', '⬆', () => reorderSelected('front'));
  const back = button('Send to back', '⬇', () => reorderSelected('back'));
  const crop = button('Crop and straighten', '✂', () => adjust.toggle());
  const del = button('Delete photo', '✕', deleteSelected, 'danger');
  bar.append(rotL, rotR, left, right, front, back, crop, del);
  workspace.appendChild(bar);

  function place(): void {
    const s = getState();
    const id = s.selectedId;
    const rect = id ? stage.itemClientRect(id) : null;
    if (!id || !rect) {
      bar.hidden = true;
      return;
    }
    const row = s.settings.layoutMode === 'row';
    const order = rowOrder();
    const idx = order.findIndex((i) => i.id === id);
    left.hidden = right.hidden = !row;
    left.disabled = idx <= 0;
    right.disabled = idx === order.length - 1;
    front.hidden = back.hidden = row;
    crop.setAttribute('aria-pressed', String(adjust.isOpen()));
    bar.hidden = false;

    const ws = workspace.getBoundingClientRect();
    const bw = bar.offsetWidth;
    const bh = bar.offsetHeight;
    const margin = 8;
    let x = rect.x - ws.left + rect.width / 2 - bw / 2;
    x = Math.max(margin, Math.min(x, ws.width - bw - margin));
    // Above the photo if there is room, otherwise just inside its top edge.
    let y = rect.y - ws.top - bh - margin;
    if (y < margin) y = Math.max(margin, rect.y - ws.top + margin);
    bar.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  stage.onRender(place);
  adjust.onToggle(place);
  window.addEventListener('resize', place);
  new ResizeObserver(place).observe(workspace);
  place();
}
