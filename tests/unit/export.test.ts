import { describe, expect, it } from 'vitest';
import { computeExportScale, exportFileName } from '../../src/io/export';

describe('export', () => {
  it('does not scale under limits', () => {
    expect(computeExportScale(4000, 4000)).toBe(1);
  });
  it('scales when a side exceeds limit', () => {
    expect(computeExportScale(20000, 100)).toBeCloseTo(16384 / 20000);
  });
  it('scales when area exceeds limit', () => {
    const s = computeExportScale(8000, 8000);
    expect(s).toBeCloseTo(0.512);
    expect(8000 * s * 8000 * s).toBeLessThanOrEqual(16_777_216 + 1e-6);
  });
  it('formats file name', () => {
    const d = new Date(2024, 0, 5, 3, 4, 9);
    expect(exportFileName(d, 'png')).toBe('collage-20240105-030409.png');
    expect(exportFileName(d, 'jpeg')).toBe('collage-20240105-030409.jpg');
  });
});
