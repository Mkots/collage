import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixtures = ['landscape-400x300.png', 'portrait-300x600.png', 'square-500x500.png'].map((f) =>
  path.join(import.meta.dirname, '../fixtures', f),
);

interface DebugState {
  items: { x: number; y: number; width: number; height: number }[];
  scale: number;
}

test('import, drag and download', async ({ page }) => {
  await page.goto('/?debug');
  await page.locator('#file-input').setInputFiles(fixtures);
  const container = page.locator('#canvas-container');
  await expect(container).toHaveAttribute('data-item-count', '3');

  const read = (): Promise<DebugState> =>
    page.evaluate(() =>
      (window as unknown as { __collage: { getState(): DebugState } }).__collage.getState(),
    );
  const before = await read();
  const box = await page.locator('#canvas-container canvas').first().boundingBox();
  if (!box) throw new Error('no canvas');
  const it = before.items[0];
  const sx = box.x + (it.x + it.width / 2) * before.scale;
  const sy = box.y + (it.y + it.height / 2) * before.scale;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 40, sy + 30, { steps: 5 });
  await page.mouse.up();
  const after = await read();
  expect(after.items[0].x !== it.x || after.items[0].y !== it.y).toBe(true);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
