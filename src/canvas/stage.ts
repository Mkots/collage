import Konva from 'konva';
import { createGuides } from './guides';
import { computeSnap } from '../snap/snap';
import { insertionIndex } from '../layout/row';
import type { Rect } from '../types';
import {
  MIN_ITEM_SIDE,
  clampPosition,
  getState,
  moveItem,
  resizeItem,
  rowOrder,
  select,
  subscribe,
} from '../state';

const SNAP_THRESHOLD_PX = 8;

export interface StageHandle {
  getScale(): number;
  /** Position of an item in page (client) coordinates, or null if it is not on the stage. */
  itemClientRect(id: string): Rect | null;
  /** Called after every re-render (state change or resize). */
  onRender(fn: () => void): void;
  renderBlob(pixelRatio: number, mime: string, quality: number): Promise<Blob | null>;
}

function checkerPattern(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillRect(8, 8, 8, 8);
  }
  return c;
}

/**
 * Draws an item: the frame is the clip rect. The photo is turned by its lossless orientation
 * (the frame already has the turned aspect ratio, so it fills the frame exactly), then zoomed and
 * finely rotated around the frame centre; anything outside the frame is cropped. Also used for the
 * export.
 */
function drawItem(ctx: Konva.Context, shape: Konva.Shape): void {
  const w = shape.width();
  const h = shape.height();
  const image = shape.getAttr('image') as ImageBitmap | undefined;
  if (!image) return;
  const zoom = shape.getAttr('viewZoom') as number;
  const rotation = shape.getAttr('viewRotation') as number;
  const orientation = (shape.getAttr('orientation') as number) ?? 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const panX = (shape.getAttr('viewPanX') as number) ?? 0;
  const panY = (shape.getAttr('viewPanY') as number) ?? 0;
  ctx.translate(w / 2 + panX * w, h / 2 + panY * h);
  ctx.rotate(((orientation + rotation) * Math.PI) / 180);
  ctx.scale(zoom, zoom);
  const [dw, dh] = orientation % 180 === 0 ? [w, h] : [h, w];
  ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}
function hitItem(ctx: Konva.Context, shape: Konva.Shape): void {
  ctx.beginPath();
  ctx.rect(0, 0, shape.width(), shape.height());
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

export function createStage(container: HTMLElement): StageHandle {
  const stage = new Konva.Stage({ container: container as HTMLDivElement, width: 1, height: 1 });
  const bgLayer = new Konva.Layer({ listening: false });
  const itemLayer = new Konva.Layer();
  const guideLayer = new Konva.Layer({ listening: false });
  stage.add(bgLayer, itemLayer, guideLayer);

  const checker = new Konva.Rect({
    listening: false,
    fillPatternImage: checkerPattern() as unknown as HTMLImageElement,
  });
  const bg = new Konva.Rect({ listening: false });
  bgLayer.add(checker, bg);

  const transformer = new Konva.Transformer({
    enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    keepRatio: true,
    rotateEnabled: false,
    boundBoxFunc: (oldBox, newBox) =>
      Math.min(newBox.width, newBox.height) < MIN_ITEM_SIDE * scale ? oldBox : newBox,
  });
  itemLayer.add(transformer);
  const guides = createGuides(guideLayer);
  const insertMarker = new Konva.Rect({ visible: false, listening: false, fill: '#ff2d7a' });
  guideLayer.add(insertMarker);
  const nodes = new Map<string, Konva.Shape>();
  const renderListeners: (() => void)[] = [];
  let scale = 1;
  let others: Rect[] = [];
  let rowOthers: Rect[] = [];

  /** Row mode: shows where the dragged photo will be inserted. */
  function drawInsertMarker(centerX: number): void {
    const s = getState();
    const idx = insertionIndex(
      rowOthers.map((o) => o.x + o.width / 2),
      centerX,
    );
    const half = Math.max(s.settings.gap / 2, 2 / scale);
    const x =
      rowOthers.length === 0
        ? centerX
        : idx === 0
          ? rowOthers[0].x - half
          : idx === rowOthers.length
            ? rowOthers[idx - 1].x + rowOthers[idx - 1].width + half
            : (rowOthers[idx - 1].x + rowOthers[idx - 1].width + rowOthers[idx].x) / 2;
    const w = 4 / scale;
    insertMarker.setAttrs({
      visible: true,
      x: x - w / 2,
      y: s.settings.padding,
      width: w,
      height: s.settings.rowHeight,
      cornerRadius: w / 2,
    });
    guideLayer.batchDraw();
  }

  stage.on('mousedown touchstart', (e) => {
    if (e.target === stage) select(null);
  });

  function attach(id: string, node: Konva.Shape): void {
    node.on('mousedown touchstart', () => select(id));
    node.on('dragstart', () => {
      const rect = (i: Rect): Rect => ({ x: i.x, y: i.y, width: i.width, height: i.height });
      others = getState()
        .items.filter((i) => i.id !== id)
        .map(rect);
      rowOthers = rowOrder()
        .filter((i) => i.id !== id)
        .map(rect);
      node.moveToTop();
      transformer.moveToTop();
      container.dataset.dragging = '';
    });
    node.on('dragmove', (e) => {
      const s = getState();
      let x = node.x();
      let y = node.y();
      if (s.settings.layoutMode === 'row') {
        node.position(clampPosition(x, y, node.width(), node.height()));
        drawInsertMarker(node.x() + node.width() / 2);
        itemLayer.batchDraw();
        return;
      }
      const evt = e.evt as MouseEvent | TouchEvent | undefined;
      if (!(evt && 'altKey' in evt && evt.altKey)) {
        const r = computeSnap(
          { x, y, width: node.width(), height: node.height() },
          others,
          { width: s.canvasWidth, height: s.canvasHeight },
          {
            threshold: SNAP_THRESHOLD_PX / scale,
            gap: s.settings.gap,
            padding: s.settings.padding,
          },
        );
        x = r.x;
        y = r.y;
        guides.draw(r.guides, scale, s.canvasWidth, s.canvasHeight);
      } else {
        guides.clear();
      }
      node.position(clampPosition(x, y, node.width(), node.height()));
      itemLayer.batchDraw();
    });
    node.on('dragend', () => {
      guides.clear();
      insertMarker.hide();
      delete container.dataset.dragging;
      moveItem(id, node.x(), node.y());
    });
    node.on('transformend', () => {
      const width = node.width() * node.scaleX();
      const height = node.height() * node.scaleY();
      node.scale({ x: 1, y: 1 });
      resizeItem(id, node.x(), node.y(), width, height);
    });
  }

  function computeScale(): number {
    const s = getState();
    if (s.canvasWidth === 0 || s.canvasHeight === 0) return 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    return Math.max(0.01, Math.min(cw / s.canvasWidth, ch / s.canvasHeight, 1));
  }

  function render(): void {
    const s = getState();
    scale = computeScale();
    const { canvasWidth: w, canvasHeight: h } = s;
    stage.size({ width: Math.max(1, w * scale), height: Math.max(1, h * scale) });
    stage.scale({ x: scale, y: scale });
    stage.container().style.visibility = s.items.length === 0 ? 'hidden' : '';

    const transparent = s.settings.background === 'transparent';
    bg.setAttrs({ width: w, height: h, fill: transparent ? undefined : s.settings.background });
    checker.setAttrs({
      width: w,
      height: h,
      visible: transparent,
      fillPatternScale: { x: 1 / scale, y: 1 / scale },
    });

    const live = new Set(s.items.map((i) => i.id));
    for (const [id, node] of nodes) {
      if (!live.has(id)) {
        node.destroy();
        nodes.delete(id);
      }
    }
    s.items.forEach((it, idx) => {
      let node = nodes.get(it.id);
      if (!node) {
        node = new Konva.Shape({ draggable: true, sceneFunc: drawItem, hitFunc: hitItem });
        nodes.set(it.id, node);
        itemLayer.add(node);
        attach(it.id, node);
      }
      node.setAttrs({
        image: it.source,
        orientation: it.orientation,
        viewZoom: it.zoom,
        viewRotation: it.rotation,
        viewPanX: it.panX,
        viewPanY: it.panY,
        x: it.x,
        y: it.y,
        width: it.width,
        height: it.height,
        scaleX: 1,
        scaleY: 1,
      });
      node.zIndex(idx);
    });
    const sel = s.selectedId ? nodes.get(s.selectedId) : undefined;
    transformer.nodes(sel ? [sel] : []);
    transformer.resizeEnabled(s.settings.layoutMode === 'free');
    transformer.moveToTop();
    stage.batchDraw();

    container.dataset.itemCount = String(s.items.length);
    container.dataset.scale = String(scale);
    container.dataset.canvasWidth = String(w);
    container.dataset.canvasHeight = String(h);
    container.dataset.layout = s.settings.layoutMode;
    renderListeners.forEach((fn) => fn());
  }

  subscribe(render);
  new ResizeObserver(render).observe(container);
  render();

  return {
    getScale: () => scale,
    itemClientRect(id) {
      const it = getState().items.find((i) => i.id === id);
      if (!it || !nodes.has(id)) return null;
      const box = stage.content.getBoundingClientRect();
      return {
        x: box.left + it.x * scale,
        y: box.top + it.y * scale,
        width: it.width * scale,
        height: it.height * scale,
      };
    },
    onRender(fn) {
      renderListeners.push(fn);
    },
    async renderBlob(pixelRatio, mime, quality) {
      const s = getState();
      const prevFill = bg.fill();
      const wasChecker = checker.visible();
      const hadTransformer = transformer.nodes();
      transformer.nodes([]);
      guideLayer.hide();
      checker.hide();
      if (mime === 'image/jpeg' && s.settings.background === 'transparent') bg.fill('#ffffff');
      try {
        const blob = await stage.toBlob({
          x: 0,
          y: 0,
          width: stage.width(),
          height: stage.height(),
          pixelRatio,
          mimeType: mime,
          quality,
        });
        return blob;
      } finally {
        bg.fill(prevFill);
        checker.visible(wasChecker);
        guideLayer.show();
        transformer.nodes(hadTransformer);
        stage.batchDraw();
      }
    },
  };
}
