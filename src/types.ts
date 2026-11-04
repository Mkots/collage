export interface CollageItem {
  id: string;
  source: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Content zoom inside the frame (1 = image fills the frame). */
  zoom: number;
  /** Content rotation inside the frame, in degrees. */
  rotation: number;
  /** Content offset from the frame centre, as a fraction of frame width (-1..1). */
  panX: number;
  /** Content offset from the frame centre, as a fraction of frame height (-1..1). */
  panY: number;
}

export interface CollageSettings {
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
