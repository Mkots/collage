import Konva from 'konva';
import type { Guide } from '../snap/snap';

export const GUIDE_COLOR = '#ff2d7a';

export function createGuides(layer: Konva.Layer): {
  draw(guides: Guide[], scale: number, canvasW: number, canvasH: number): void;
  clear(): void;
} {
  const lines: Konva.Line[] = [];
  return {
    draw(guides, scale) {
      lines.forEach((l) => l.destroy());
      lines.length = 0;
      for (const g of guides) {
        const pts =
          g.orientation === 'vertical'
            ? [g.position, g.start, g.position, g.end]
            : [g.start, g.position, g.end, g.position];
        const line = new Konva.Line({
          points: pts,
          stroke: GUIDE_COLOR,
          strokeWidth: 1 / scale,
          dash: [4 / scale, 4 / scale],
          listening: false,
        });
        lines.push(line);
        layer.add(line);
      }
      layer.batchDraw();
    },
    clear() {
      lines.forEach((l) => l.destroy());
      lines.length = 0;
      layer.batchDraw();
    },
  };
}
