export interface CollageItem {
  id: string;
  source: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
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
