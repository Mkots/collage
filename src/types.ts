/** Lossless quarter-turn orientation of the photo (the frame turns with it, nothing is cropped). */
export type Orientation = 0 | 90 | 180 | 270;

export interface CollageItem {
  id: string;
  source: ImageBitmap;
  /** Size of the source bitmap as decoded (before `orientation` is applied). */
  naturalWidth: number;
  naturalHeight: number;
  orientation: Orientation;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Content zoom inside the frame (1 = image fills the frame). */
  zoom: number;
  /** Fine content rotation inside the frame (straighten), in degrees; overflow is cropped. */
  rotation: number;
  /** Content offset from the frame centre, as a fraction of frame width (-1..1). */
  panX: number;
  /** Content offset from the frame centre, as a fraction of frame height (-1..1). */
  panY: number;
}

/**
 * `row`: photos are always kept in one horizontal row of equal height (drag to reorder).
 * `free`: photos can be moved and resized anywhere on the canvas.
 */
export type LayoutMode = 'row' | 'free';

export interface CollageSettings {
  layoutMode: LayoutMode;
  rowHeight: number;
  gap: number;
  padding: number;
  background: string;
  exportFormat: 'png' | 'jpeg';
  jpegQuality: number;
}

export interface CollageState {
  items: CollageItem[];
  canvasWidth: number;
  canvasHeight: number;
  settings: CollageSettings;
  selectedId: string | null;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
