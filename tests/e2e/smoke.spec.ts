import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';

const fixtures = ['landscape-400x300.png', 'portrait-300x600.png', 'square-500x500.png'].map((f) =>
  path.join(import.meta.dirname, '../fixtures', f),
);

interface DebugItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: number;
}
interface DebugState {
  items: DebugItem[];
  scale: number;
}

const read = (page: Page): Promise<DebugState> =>
  page.evaluate(() =>
    (window as unknown as { __collage: { getState(): DebugState } }).__collage.getState(),
  );

async function drag(page: Page, s: DebugState, it: DebugItem, dx: number, dy: number) {
  const box = await page.locator('#canvas-container canvas').first().boundingBox();
  if (!box) throw new Error('no canvas');
  const sx = box.x + (it.x + it.width / 2) * s.scale;
  const sy = box.y + (it.y + it.height / 2) * s.scale;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + dx, sy + dy, { steps: 8 });
  await page.mouse.up();
}

test('import, rotate without cropping, reorder, free drag and download', async ({ page }) => {
  await page.goto('/?debug');
  await page.locator('#file-input').setInputFiles(fixtures);
  const container = page.locator('#canvas-container');
  await expect(container).toHaveAttribute('data-item-count', '3');

  // Rotating all photos swaps every frame's sides (nothing is cropped).
  const before = await read(page);
  await page.getByRole('button', { name: 'Rotate all photos 90° right' }).click();
  const rotated = await read(page);
  rotated.items.forEach((it, i) => {
    expect(it.orientation).toBe(90);
    const b = before.items[i];
    expect(it.width / it.height).toBeCloseTo(b.height / b.width, 1);
  });

  // Row mode: dragging the first photo past the last one moves it to the end of the row.
  const first = rotated.items[0];
  const last = rotated.items[2];
  await drag(page, rotated, first, (last.x + last.width - first.x) * rotated.scale + 5, 0);
  const reordered = await read(page);
  const order = [...reordered.items].sort((a, b) => a.x - b.x).map((i) => i.id);
  expect(order.at(-1)).toBe(first.id);

  // The selected photo has a floating bar; rotating from it turns only that photo back.
  await expect(page.getByRole('toolbar', { name: 'Selected photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Rotate photo 90° left' }).click();
  const one = (await read(page)).items.find((i) => i.id === first.id);
  expect(one?.orientation).toBe(0);

  // Free mode: photos can be dragged anywhere.
  await page.getByRole('button', { name: /Free layout/ }).click();
  const free = await read(page);
  const it = free.items[1];
  await drag(page, free, it, 40, 30);
  const moved = (await read(page)).items[1];
  expect(moved.x !== it.x || moved.y !== it.y).toBe(true);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
