import Konva from 'konva';
import { createGuides } from './guides';
import { computeSnap } from '../snap/snap';
import type { Rect } from '../types';
import {
  MIN_ITEM_SIDE,
  clampPosition,
  getState,
  moveItem,
  resizeItem,
  select,
  subscribe,
} from '../state';

const SNAP_THRESHOLD_PX = 8;

export interface StageHandle {
  getScale(): number;
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
  const nodes = new Map<string, Konva.Image>();
  let scale = 1;
  let others: Rect[] = [];

  stage.on('mousedown touchstart', (e) => {
    if (e.target === stage) select(null);
  });

  function attach(id: string, node: Konva.Image): void {
    node.on('mousedown touchstart', () => select(id));
    node.on('dragstart', () => {
      others = getState()
        .items.filter((i) => i.id !== id)
        .map((i) => ({ x: i.x, y: i.y, width: i.width, height: i.height }));
    });
    node.on('dragmove', (e) => {
      const s = getState();
      let x = node.x();
      let y = node.y();
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
    stage.container().style.display = s.items.length === 0 ? 'none' : 'block';

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
        node = new Konva.Image({ image: it.source, draggable: true });
        nodes.set(it.id, node);
        itemLayer.add(node);
        attach(it.id, node);
      }
      node.setAttrs({
        image: it.source,
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
    transformer.moveToTop();
    stage.batchDraw();

    container.dataset.itemCount = String(s.items.length);
    container.dataset.scale = String(scale);
    container.dataset.canvasWidth = String(w);
    container.dataset.canvasHeight = String(h);
  }

  subscribe(render);
  new ResizeObserver(render).observe(container);
  render();

  return {
    getScale: () => scale,
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
