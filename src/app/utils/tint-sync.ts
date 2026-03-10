/**
 * TintSync — Dominant Color Extraction & Normalization
 * Ported to TypeScript. Zero dependencies, no DOM required.
 */

function toHex(c: number): string {
  return c.toString(16).padStart(2, '0');
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function luminance(r: number, g: number, b: number): number {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

interface HSV { h: number; s: number; v: number; }
interface Lab { L: number; a: number; b: number; }
interface RGB { r: number; g: number; b: number; }
interface HSL { h: number; s: number; l: number; }

function rgbToHsv(r: number, g: number, b: number): HSV {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rr: h = ((gg - bb) / d) % 6; break;
      case gg: h = (bb - rr) / d + 2; break;
      case bb: h = (rr - gg) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function isNearBlackWhite(r: number, g: number, b: number): boolean {
  const hsv = rgbToHsv(r, g, b);
  if (hsv.v < 0.08) return true;
  if (hsv.v > 0.92 && hsv.s < 0.08) return true;
  return false;
}

function isIgnorableColor(r: number, g: number, b: number): boolean {
  const hsv = rgbToHsv(r, g, b);
  if (hsv.v < 0.05) return true;
  if (hsv.v > 0.90 && hsv.s < 0.1) return true;
  return false;
}

function hsvDist(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

// ── Color Space Conversion (RGB ↔ CIELAB) ───────────────

function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) * 100;
  const Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) * 100;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) * 100;
  const Xn = 95.047, Yn = 100.0, Zn = 108.883;
  function fXYZ(t: number) { return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116); }
  const fx = fXYZ(X / Xn), fy = fXYZ(Y / Yn), fz = fXYZ(Z / Zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function labToRgb(L: number, a: number, b: number): RGB {
  const Yn = 100.0, Xn = 95.047, Zn = 108.883;
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  function invf(t: number) { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; }
  const xr = invf(fx), yr = invf(fy), zr = invf(fz);
  const X = xr * Xn, Y = yr * Yn, Z = zr * Zn;
  const Rlin = X / 100 * 3.2406 + Y / 100 * -1.5372 + Z / 100 * -0.4986;
  const Glin = X / 100 * -0.9689 + Y / 100 * 1.8758 + Z / 100 * 0.0415;
  const Blin = X / 100 * 0.0557 + Y / 100 * -0.2040 + Z / 100 * 1.0570;
  return {
    r: clamp(Math.round(linearToSrgb(Rlin) * 255)),
    g: clamp(Math.round(linearToSrgb(Glin) * 255)),
    b: clamp(Math.round(linearToSrgb(Blin) * 255))
  };
}

// ── Border Detection ─────────────────────────────────────

function estimateBorderMargins(w: number, h: number, data: Uint8ClampedArray | number[]) {
  const stripX = Math.max(1, Math.floor(w * 0.05));
  const stripY = Math.max(1, Math.floor(h * 0.05));

  function stripMetrics(x0: number, y0: number, x1: number, y1: number) {
    let n = 0, sSum = 0, nearBW = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        if (a < 128) continue;
        const hsv = rgbToHsv(r, g, b);
        sSum += hsv.s;
        if (isIgnorableColor(r, g, b)) nearBW++;
        n++;
      }
    }
    const sAvg = n ? sSum / n : 0;
    const bwRatio = n ? nearBW / n : 1;
    return { sAvg, bwRatio };
  }

  const top = stripMetrics(0, 0, w, stripY);
  const bottom = stripMetrics(0, h - stripY, w, h);
  const left = stripMetrics(0, 0, stripX, h);
  const right = stripMetrics(w - stripX, 0, w, h);

  const mTop    = (top.sAvg < 0.1 || top.bwRatio > 0.6)      ? Math.floor(h * 0.08) : 0;
  const mBottom = (bottom.sAvg < 0.1 || bottom.bwRatio > 0.6) ? Math.floor(h * 0.08) : 0;
  const mLeft   = (left.sAvg < 0.1 || left.bwRatio > 0.6)     ? Math.floor(w * 0.08) : 0;
  const mRight  = (right.sAvg < 0.1 || right.bwRatio > 0.6)   ? Math.floor(w * 0.08) : 0;

  return { mTop, mBottom, mLeft, mRight };
}

// ── K-Means++ Initialization ─────────────────────────────

interface Sample { r: number; g: number; b: number; lab: Lab; w: number; h: number; }

export interface PaletteEntry {
  rgb: RGB;
  hex: string;
  normalizedRgb: RGB;
  normalizedHex: string;
  weight: number;        // 0–1 relative weight
  isNearBW: boolean;
}

function initCentersKMeansPP(points: Sample[], k: number): Lab[] {
  const cs: Lab[] = [];
  if (points.length === 0) return cs;

  let maxW = -1, maxIdx = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].w > maxW) { maxW = points[i].w; maxIdx = i; }
  }
  cs.push(points[maxIdx].lab);

  while (cs.length < k) {
    const dists = points.map(p => {
      let minD = Infinity;
      const s = p.lab;
      for (let j = 0; j < cs.length; j++) {
        const c = cs[j];
        const d = (s.L - c.L) ** 2 + (s.a - c.a) ** 2 + (s.b - c.b) ** 2;
        if (d < minD) minD = d;
      }
      return minD;
    });
    const sum = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let idx = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { idx = i; break; }
    }
    cs.push(points[idx].lab);
  }
  return cs;
}

// ── Main: Extract Dominant Color ─────────────────────────

export function extractDominantColor(data: Uint8ClampedArray | number[], w: number, h: number): RGB {
  const samples: Sample[] = [];
  const margins = estimateBorderMargins(w, h, data);
  const hueBins = new Array(36).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;

    const idxPix = i / 4;
    const y = Math.floor(idxPix / w);
    const x = idxPix % w;
    if (y < margins.mTop || y >= h - margins.mBottom || x < margins.mLeft || x >= w - margins.mRight) continue;
    if (isIgnorableColor(r, g, b)) continue;

    const hsv = rgbToHsv(r, g, b);
    const wgt = Math.pow(hsv.s, 1.2) * (hsv.v > 0.5 ? 1 : 0.7);
    if (hsv.s < 0.05 || hsv.v < 0.15) continue;

    samples.push({ r, g, b, lab: rgbToLab(r, g, b), w: wgt, h: hsv.h });
    const bin = Math.floor(hsv.h / 10);
    hueBins[bin] += wgt;
  }

  if (samples.length === 0) return { r: 200, g: 200, b: 200 };

  const totalWeight = samples.reduce((sum, s) => sum + s.w, 0);

  // Fast path: if one hue clearly dominates, average that band in CIELAB
  const peakIdx = hueBins.reduce((p, cur, i) => cur > hueBins[p] ? i : p, 0);
  if (hueBins[peakIdx] / totalWeight > 0.2) {
    const peakHue = peakIdx * 10 + 5;
    const band = samples.filter(s => hsvDist(s.h, peakHue) <= 15);
    const bandWeight = band.reduce((sum, s) => sum + s.w, 0);
    if (bandWeight / totalWeight > 0.15) {
      let L = 0, A = 0, B = 0, W = 0;
      for (let j = 0; j < band.length; j++) {
        L += band[j].lab.L * band[j].w;
        A += band[j].lab.a * band[j].w;
        B += band[j].lab.b * band[j].w;
        W += band[j].w;
      }
      if (W > 0) {
        return labToRgb(L / W, A / W, B / W);
      }
    }
  }

  // Slow path: K-Means++ clustering (k=6) in CIELAB space
  const k = 6;
  const centers = initCentersKMeansPP(samples, k).map(c => ({ L: c.L, a: c.a, b: c.b, w: 0 }));
  const maxIter = 10;
  const assignments = new Int32Array(samples.length);

  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < samples.length; i++) {
      let best = 0, bestDist = Infinity;
      const s = samples[i].lab;
      for (let c = 0; c < centers.length; c++) {
        const cc = centers[c];
        const d = (s.L - cc.L) ** 2 + (s.a - cc.a) ** 2 + (s.b - cc.b) ** 2;
        if (d < bestDist) { bestDist = d; best = c; }
      }
      assignments[i] = best;
    }
    const acc = centers.map(() => ({ L: 0, a: 0, b: 0, w: 0 }));
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i].lab;
      const idx = assignments[i];
      const wgt = samples[i].w;
      acc[idx].L += s.L * wgt;
      acc[idx].a += s.a * wgt;
      acc[idx].b += s.b * wgt;
      acc[idx].w += wgt;
    }
    for (let c = 0; c < centers.length; c++) {
      if (acc[c].w > 0) {
        centers[c] = { L: acc[c].L / acc[c].w, a: acc[c].a / acc[c].w, b: acc[c].b / acc[c].w, w: 0 };
      }
    }
  }

  const finalWeights = new Array(centers.length).fill(0);
  for (let i = 0; i < assignments.length; i++) finalWeights[assignments[i]] += samples[i].w;
  const order = centers.map((_, i) => i).sort((a, b) => finalWeights[b] - finalWeights[a]);

  for (let j = 0; j < order.length; j++) {
    const rgb = labToRgb(centers[order[j]].L, centers[order[j]].a, centers[order[j]].b);
    if (!isNearBlackWhite(rgb.r, rgb.g, rgb.b)) return rgb;
  }
  return labToRgb(centers[order[0]].L, centers[order[0]].a, centers[order[0]].b);
}

// ── Extract Full Palette (all K-Means clusters) ─────────

export function extractColorPalette(data: Uint8ClampedArray | number[], w: number, h: number): PaletteEntry[] {
  const samples: Sample[] = [];
  const margins = estimateBorderMargins(w, h, data);
  const hueBins = new Array(36).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;

    const idxPix = i / 4;
    const y = Math.floor(idxPix / w);
    const x = idxPix % w;
    if (y < margins.mTop || y >= h - margins.mBottom || x < margins.mLeft || x >= w - margins.mRight) continue;
    if (isIgnorableColor(r, g, b)) continue;

    const hsv = rgbToHsv(r, g, b);
    const wgt = Math.pow(hsv.s, 1.2) * (hsv.v > 0.5 ? 1 : 0.7);
    if (hsv.s < 0.05 || hsv.v < 0.15) continue;

    samples.push({ r, g, b, lab: rgbToLab(r, g, b), w: wgt, h: hsv.h });
    const bin = Math.floor(hsv.h / 10);
    hueBins[bin] += wgt;
  }

  if (samples.length === 0) {
    const fallback: RGB = { r: 200, g: 200, b: 200 };
    const normFallback = normalizeForWhiteContrast(200, 200, 200);
    return [{
      rgb: fallback,
      hex: rgbToHex(200, 200, 200),
      normalizedRgb: normFallback,
      normalizedHex: rgbToHex(normFallback.r, normFallback.g, normFallback.b),
      weight: 1,
      isNearBW: true,
    }];
  }

  // Always run K-Means++ clustering (k=6) in CIELAB space
  const k = 6;
  const centers = initCentersKMeansPP(samples, k).map(c => ({ L: c.L, a: c.a, b: c.b, w: 0 }));
  const maxIter = 10;
  const assignments = new Int32Array(samples.length);

  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < samples.length; i++) {
      let best = 0, bestDist = Infinity;
      const s = samples[i].lab;
      for (let c = 0; c < centers.length; c++) {
        const cc = centers[c];
        const d = (s.L - cc.L) ** 2 + (s.a - cc.a) ** 2 + (s.b - cc.b) ** 2;
        if (d < bestDist) { bestDist = d; best = c; }
      }
      assignments[i] = best;
    }
    const acc = centers.map(() => ({ L: 0, a: 0, b: 0, w: 0 }));
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i].lab;
      const idx = assignments[i];
      const wgt = samples[i].w;
      acc[idx].L += s.L * wgt;
      acc[idx].a += s.a * wgt;
      acc[idx].b += s.b * wgt;
      acc[idx].w += wgt;
    }
    for (let c = 0; c < centers.length; c++) {
      if (acc[c].w > 0) {
        centers[c] = { L: acc[c].L / acc[c].w, a: acc[c].a / acc[c].w, b: acc[c].b / acc[c].w, w: 0 };
      }
    }
  }

  const finalWeights = new Array(centers.length).fill(0);
  for (let i = 0; i < assignments.length; i++) finalWeights[assignments[i]] += samples[i].w;
  const totalWeight = finalWeights.reduce((a: number, b: number) => a + b, 0);
  const order = centers.map((_, i) => i).sort((a, b) => finalWeights[b] - finalWeights[a]);

  const palette: PaletteEntry[] = [];
  for (let j = 0; j < order.length; j++) {
    const idx = order[j];
    const w2 = finalWeights[idx];
    if (w2 <= 0) continue; // skip empty clusters
    const rgb = labToRgb(centers[idx].L, centers[idx].a, centers[idx].b);
    const norm = normalizeForWhiteContrast(rgb.r, rgb.g, rgb.b, 0.10, 6.0);
    palette.push({
      rgb,
      hex: rgbToHex(rgb.r, rgb.g, rgb.b),
      normalizedRgb: norm,
      normalizedHex: rgbToHex(norm.r, norm.g, norm.b),
      weight: w2 / totalWeight,
      isNearBW: isNearBlackWhite(rgb.r, rgb.g, rgb.b),
    });
  }

  return palette;
}

// ── Normalize for White Text Contrast ────────────────────

export function normalizeForWhiteContrast(r: number, g: number, b: number, targetL = 0.10, minRatio = 6.0): RGB {
  let Rlin = srgbToLinear(r), Glin = srgbToLinear(g), Blin = srgbToLinear(b);
  const L = 0.2126 * Rlin + 0.7152 * Glin + 0.0722 * Blin;
  const Lmax = Math.max(0, Math.min(1, (1.05 / minRatio) - 0.05));
  const desired = Math.min(targetL, Lmax);

  if (L === 0) {
    Rlin = desired; Glin = desired; Blin = desired;
  } else {
    const k = desired / L;
    Rlin = Math.min(1, Rlin * k);
    Glin = Math.min(1, Glin * k);
    Blin = Math.min(1, Blin * k);
  }

  return {
    r: clamp(Math.round(linearToSrgb(Rlin) * 255)),
    g: clamp(Math.round(linearToSrgb(Glin) * 255)),
    b: clamp(Math.round(linearToSrgb(Blin) * 255))
  };
}

// ── Contrast Checker ─────────────────────────────────────

export function contrastWithWhite(r: number, g: number, b: number): number {
  const L = luminance(r, g, b);
  return (1.0 + 0.05) / (L + 0.05);
}

// ── HSL Conversion Helpers ───────────────────────────────

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rr: h = (gg - bb) / d + (gg < bb ? 6 : 0); break;
      case gg: h = (bb - rr) / d + 2; break;
      case bb: h = (rr - gg) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const hh = h / 360, ss = s / 100, ll = l / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  return {
    r: Math.round(hue2rgb(p, q, hh + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hh) * 255),
    b: Math.round(hue2rgb(p, q, hh - 1/3) * 255),
  };
}