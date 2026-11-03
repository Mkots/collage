import { showToast } from '../ui/toast';

export const MAX_SOURCE_SIDE = 4096;

export async function decodeFile(file: File): Promise<ImageBitmap | null> {
  if (!file.type.startsWith('image/')) return null;
  try {
    const full = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longest = Math.max(full.width, full.height);
    if (longest <= MAX_SOURCE_SIDE) return full;
    const opts: ImageBitmapOptions = {
      imageOrientation: 'from-image',
      resizeQuality: 'high',
      ...(full.width >= full.height
        ? { resizeWidth: MAX_SOURCE_SIDE }
        : { resizeHeight: MAX_SOURCE_SIDE }),
    };
    full.close();
    try {
      return await createImageBitmap(file, opts);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function decodeFiles(files: File[]): Promise<ImageBitmap[]> {
  const out: ImageBitmap[] = [];
  for (const f of files) {
    const bmp = await decodeFile(f);
    if (bmp) out.push(bmp);
    else showToast(`Could not load "${f.name}"`);
  }
  return out;
}

export function setupImport(
  input: HTMLInputElement,
  overlay: HTMLElement,
  onImages: (b: ImageBitmap[]) => void,
): void {
  const handle = async (files: File[]): Promise<void> => {
    if (files.length) onImages(await decodeFiles(files));
  };
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    void handle(files);
  });
  const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer?.types.includes('Files');
  let depth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    overlay.hidden = false;
  });
  window.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) overlay.hidden = true;
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    void handle(Array.from(e.dataTransfer?.files ?? []));
  });
  window.addEventListener('paste', (e) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (files.length) {
      e.preventDefault();
      void handle(files);
    }
  });
}
