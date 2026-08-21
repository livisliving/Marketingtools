import * as htmlToImage from 'html-to-image';

// Hard ceiling for every exported banner image.
export const MAX_EXPORT_BYTES = 300 * 1024; // 300 KB

export interface RenderedBanner {
  blob: Blob;
  mimeType: string;
  /** File extension without the dot. */
  ext: 'jpg';
  /** JPEG quality actually used. */
  quality: number;
  bytes: number;
  /** True when we could not get under MAX_EXPORT_BYTES even at the lowest quality. */
  overLimit: boolean;
}

const JPEG_MAX_QUALITY = 0.95;
const JPEG_MIN_QUALITY = 0.4;
const SEARCH_ITERATIONS = 7;

/** Convert a `data:` URL to a Blob and report its exact byte size. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Render a DOM node to the smallest-yet-best-quality JPEG that fits within
 * MAX_EXPORT_BYTES.
 *
 * Banners are full-frame and opaque (the export node has a solid white
 * background), so JPEG compresses their photographic content far smaller than
 * lossless PNG — typically 5–15× — while `quality` genuinely takes effect.
 * We render at the best quality first; if that overshoots the 300 KB cap we
 * binary-search the JPEG quality downward only as far as needed, so the output
 * is always the highest quality the size limit allows.
 *
 * NOTE: we use `toJpeg` (not `toBlob({ type })`) because html-to-image's
 * `toBlob` does not reliably honour the JPEG type/quality options and falls
 * back to PNG.
 */
export async function renderBanner(
  node: HTMLElement,
  width: number,
  height: number,
): Promise<RenderedBanner> {
  const opts = {
    width,
    height,
    pixelRatio: 1,
    // White backstop so any transparent pixel renders white, not black.
    backgroundColor: '#ffffff',
    style: { transform: 'scale(1)', transformOrigin: 'top left' },
  } as const;

  const renderAt = async (quality: number) => {
    const dataUrl = await htmlToImage.toJpeg(node, { ...opts, quality });
    const blob = dataUrlToBlob(dataUrl);
    return { blob, quality, bytes: blob.size };
  };

  // Best-quality attempt first — most banners already fit here.
  const best = await renderAt(JPEG_MAX_QUALITY);
  if (best.bytes <= MAX_EXPORT_BYTES) {
    return { ...best, mimeType: 'image/jpeg', ext: 'jpg', overLimit: false };
  }

  // Binary-search the highest quality whose output is <= the cap.
  let lo = JPEG_MIN_QUALITY;
  let hi = JPEG_MAX_QUALITY;
  let bestFit: { blob: Blob; quality: number; bytes: number } | null = null;
  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const attempt = await renderAt(mid);
    if (attempt.bytes <= MAX_EXPORT_BYTES) {
      bestFit = attempt;
      lo = mid; // room to push quality higher
    } else {
      hi = mid; // too big, lower quality
    }
  }

  if (bestFit) {
    return { ...bestFit, mimeType: 'image/jpeg', ext: 'jpg', overLimit: false };
  }

  // Could not fit even at min quality — return the smallest and flag it.
  const floor = await renderAt(JPEG_MIN_QUALITY);
  return { ...floor, mimeType: 'image/jpeg', ext: 'jpg', overLimit: floor.bytes > MAX_EXPORT_BYTES };
}
