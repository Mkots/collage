# Collage

A client-side image collage tool. Load images, they are laid out in a single row, then drag them
anywhere on the canvas with snapping to other images and canvas edges, and export a PNG/JPEG.
Images never leave your browser; there is no backend.

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

## Zoom and rotate

Select an image: the toolbar has zoom −/＋, 90° rotate buttons and Reset view, and a panel appears
with sliders/number fields for free rotation (any angle), zoom, and vertical/horizontal shift of the
image inside its frame. The image is transformed around the centre of its frame; anything outside the
frame is cropped (also in the export).

## Keyboard shortcuts

| Key                          | Action                          |
| ---------------------------- | ------------------------------- |
| Arrow keys / Shift+Arrow     | Move selected item 1 px / 10 px |
| Delete / Backspace           | Delete selected item            |
| Escape                       | Deselect                        |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Undo / redo (50 steps)          |
| Hold Alt while dragging      | Disable snapping                |

## Known limits

- Export is limited to 16384 px per side and 16,777,216 pixels total; larger canvases are scaled down automatically with a warning.
- Source images with a longest side above 4096 px are downscaled on import.
