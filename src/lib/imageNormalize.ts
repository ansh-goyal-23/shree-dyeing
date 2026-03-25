/**
 * Mild image normalization: auto-levels (brightness/contrast) + gray-world white balance.
 * Designed to be subtle — no heavy color shifts, just consistent natural correction
 * for better shade reference photography.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Apply mild normalization to an image file.
 * Returns a new File with corrections applied.
 */
export async function normalizeImage(file: File): Promise<{ normalizedFile: File; normalizedUrl: string; originalUrl: string }> {
  const originalUrl = URL.createObjectURL(file);
  const img = await loadImage(originalUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const pixelCount = data.length / 4;

  // ── Pass 1: Gather stats per channel ──
  let rSum = 0, gSum = 0, bSum = 0;
  const rHist = new Uint32Array(256);
  const gHist = new Uint32Array(256);
  const bHist = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    rSum += r; gSum += g; bSum += b;
    rHist[r]++; gHist[g]++; bHist[b]++;
  }

  // ── Auto-levels: clip 0.5% from each tail per channel ──
  const clipFraction = 0.005;
  const clipCount = Math.floor(pixelCount * clipFraction);

  function findClipBounds(hist: Uint32Array): [number, number] {
    let lo = 0, hi = 255;
    let cumLo = 0, cumHi = 0;
    while (lo < 255 && cumLo + hist[lo] <= clipCount) { cumLo += hist[lo]; lo++; }
    while (hi > 0 && cumHi + hist[hi] <= clipCount) { cumHi += hist[hi]; hi--; }
    if (lo >= hi) { lo = 0; hi = 255; } // safety
    return [lo, hi];
  }

  const [rLo, rHi] = findClipBounds(rHist);
  const [gLo, gHi] = findClipBounds(gHist);
  const [bLo, bHi] = findClipBounds(bHist);

  // ── Gray-world white balance (mild) ──
  const rAvg = rSum / pixelCount;
  const gAvg = gSum / pixelCount;
  const bAvg = bSum / pixelCount;
  const gray = (rAvg + gAvg + bAvg) / 3;

  // Blend factor: 0 = no WB, 1 = full gray-world. Keep mild at 0.4
  const wbStrength = 0.4;
  const rScale = 1 + wbStrength * (gray / (rAvg || 1) - 1);
  const gScale = 1 + wbStrength * (gray / (gAvg || 1) - 1);
  const bScale = 1 + wbStrength * (gray / (bAvg || 1) - 1);

  // ── Pass 2: Apply corrections ──
  // Blend auto-levels mildly too (0.6 strength)
  const levelsStrength = 0.6;

  function correct(val: number, lo: number, hi: number, scale: number): number {
    // Auto-levels stretch
    const range = hi - lo || 1;
    const stretched = ((val - lo) / range) * 255;
    const leveled = val + levelsStrength * (stretched - val);
    // White balance
    const balanced = leveled * scale;
    return Math.max(0, Math.min(255, Math.round(balanced)));
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = correct(data[i], rLo, rHi, rScale);
    data[i + 1] = correct(data[i + 1], gLo, gHi, gScale);
    data[i + 2] = correct(data[i + 2], bLo, bHi, bScale);
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);

  // Convert canvas to File
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), file.type || 'image/jpeg', 0.92);
  });

  const normalizedFile = new File([blob], file.name, { type: blob.type });
  const normalizedUrl = URL.createObjectURL(blob);

  return { normalizedFile, normalizedUrl, originalUrl };
}
