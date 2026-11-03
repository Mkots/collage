export const MAX_EXPORT_SIDE = 16384;
export const MAX_EXPORT_PIXELS = 16_777_216;

/** Largest uniform scale (<= 1) at which the canvas fits the browser limits. */
export function computeExportScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  const bySide = MAX_EXPORT_SIDE / Math.max(width, height);
  const byArea = Math.sqrt(MAX_EXPORT_PIXELS / (width * height));
  return Math.min(1, bySide, byArea);
}

export function exportFileName(date: Date, format: 'png' | 'jpeg'): string {
  const p = (n: number, l = 2): string => String(n).padStart(l, '0');
  const stamp =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-` +
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `collage-${stamp}.${format === 'png' ? 'png' : 'jpg'}`;
}

export interface BlobRenderer {
  renderBlob(pixelRatio: number, mime: string, quality: number): Promise<Blob | null>;
  getScale(): number;
}

export async function exportCollage(
  renderer: BlobRenderer,
  size: { width: number; height: number },
  settings: { exportFormat: 'png' | 'jpeg'; jpegQuality: number },
  notify: (msg: string) => void,
): Promise<void> {
  const scale = computeExportScale(size.width, size.height);
  const mime = settings.exportFormat === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await renderer.renderBlob(scale / renderer.getScale(), mime, settings.jpegQuality);
  if (!blob) {
    notify('Export failed: the canvas could not be rendered');
    return;
  }
  if (scale < 1) notify(`Exported at ${Math.floor(scale * 100)}% due to browser size limits`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(new Date(), settings.exportFormat);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
