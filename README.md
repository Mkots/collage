# Collage

A client-side tool for horizontal photo collages. Add photos (they are placed in one row in
file-name order), rotate them, reorder them, and export a PNG/JPEG.
Images never leave your browser; there is no backend.

## How it works

1. **Add photos**: click, drop files anywhere, or paste.
2. **Rotate**: `⟲ All` / `⟳ All` turn every photo by 90°. To turn just one, click it and use
   ⟲ / ⟳ in the bar that appears over it (or press `R` / `Shift+R`). The photo turns as a whole and
   its frame swaps width and height, so nothing is cropped. The row re-flows automatically.
3. **Reorder**: drag a photo to a new place in the row (a marker shows where it goes), or use ◀ / ▶.
4. **Download**.

Layout modes:

- **Row** (default): photos always form one row of equal height. Deleting, adding or rotating
  re-flows the row. In ⚙ Settings, set **Row height**, or type a **Width** / **Height** and the row
  height is chosen to fit it.
- **Free**: move and resize photos anywhere, with snapping to other photos and canvas edges.
  Switching back to Row lines them up again (undoable).

## Development

```
npm ci
npm run dev        # dev server
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/
npm test           # unit tests (Vitest)
npm run test:e2e   # Playwright smoke test (run `npx playwright install chromium` first)
npm run lint
npm run format
npm run typecheck
```

## Deploying to GitHub Pages

Settings → Pages → Source: **GitHub Actions**. Pushes to `main` run `.github/workflows/deploy.yml`.

## Crop and straighten

Select a photo and press ✂ in its bar: a panel opens with zoom, straighten (fine rotation) and
horizontal/vertical shift of the photo inside its frame. Anything outside the frame is cropped (also
in the export). Unlike the 90° rotation, this does not change the frame.

## Keyboard shortcuts

| Key                          | Action                                                |
| ---------------------------- | ----------------------------------------------------- |
| R / Shift+R                  | Rotate selected photo 90° right / left (no crop)      |
| ← / →                        | Row mode: move selected photo left / right in the row |
| Arrow keys / Shift+Arrow     | Free mode: move selected item 1 px / 10 px            |
| Delete / Backspace           | Delete selected item                                  |
| Escape                       | Deselect                                              |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Undo / redo (50 steps)                                |
| Hold Alt while dragging      | Free mode: disable snapping                           |

## Known limits

- Export is limited to 16384 px per side and 16,777,216 pixels total; larger canvases are scaled down automatically with a warning.
- Source images with a longest side above 4096 px are downscaled on import.
