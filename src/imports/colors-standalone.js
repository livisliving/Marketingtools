/**
 * TintSync — Dominant Color Extraction & Normalization
 * Single file, zero dependencies, no DOM required.
 *
 * Usage:
 *   // Extract from raw RGBA pixel data (Uint8Array or array of [r,g,b,a,...])
 *   var color = TintSync.extractDominantColor(rgbaData, width, height);
 *   // Returns { r, g, b }
 *
 *   // Darken so white text is readable
 *   var normalized = TintSync.normalizeForWhiteContrast(color.r, color.g, color.b, 0.10, 6.0);
 *
 *   // Convert to hex
 *   var hex = TintSync.rgbToHex(normalized.r, normalized.g, normalized.b); // "#1A3F6B"
 *
 *   // Check contrast ratio against white
 *   var ratio = TintSync.contrastWithWhite(normalized.r, normalized.g, normalized.b);
 */
var TintSync = (function () {

  // ── Helpers ──────────────────────────────────────────────

  function toHex(c) {
    return c.toString(16).padStart(2, '0');
  }

  function rgbToHex(r, g, b) {
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function clamp(v) {
    return Math.max(0, Math.min(255, v));
  }

  function srgbToLinear(c) {
    var v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(v) {
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }

  function luminance(r, g, b) {
    var R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function rgbToHsv(r, g, b) {
    var rr = r / 255, gg = g / 255, bb = b / 255;
    var max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
    var d = max - min;
    var h = 0;
    if (d !== 0) {
      switch (max) {
        case rr: h = ((gg - bb) / d) % 6; break;
        case gg: h = (bb - rr) / d + 2; break;
        case bb: h = (rr - gg) / d + 4; break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    var s = max === 0 ? 0 : d / max;
    var v = max;
    return { h: h, s: s, v: v };
  }

  function isNearBlackWhite(r, g, b) {
    var hsv = rgbToHsv(r, g, b);
    if (hsv.v < 0.08) return true;
    if (hsv.v > 0.92 && hsv.s < 0.08) return true;
    return false;
  }

  function isIgnorableColor(r, g, b) {
    var hsv = rgbToHsv(r, g, b);
    if (hsv.v < 0.05) return true;
    if (hsv.v > 0.90 && hsv.s < 0.1) return true;
    return false;
  }

  function hsvDist(a, b) {
    var d = Math.abs(a - b);
    return Math.min(d, 360 - d);
  }

  // ── Color Space Conversion (RGB ↔ CIELAB) ───────────────

  function rgbToLab(r, g, b) {
    var R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    var X = (0.4124 * R + 0.3576 * G + 0.1805 * B) * 100;
    var Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) * 100;
    var Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) * 100;
    var Xn = 95.047, Yn = 100.0, Zn = 108.883;
    function fXYZ(t) { return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116); }
    var fx = fXYZ(X / Xn), fy = fXYZ(Y / Yn), fz = fXYZ(Z / Zn);
    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function labToRgb(L, a, b) {
    var Yn = 100.0, Xn = 95.047, Zn = 108.883;
    var fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
    function invf(t) { var t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; }
    var xr = invf(fx), yr = invf(fy), zr = invf(fz);
    var X = xr * Xn, Y = yr * Yn, Z = zr * Zn;
    var Rlin = X / 100 * 3.2406 + Y / 100 * -1.5372 + Z / 100 * -0.4986;
    var Glin = X / 100 * -0.9689 + Y / 100 * 1.8758 + Z / 100 * 0.0415;
    var Blin = X / 100 * 0.0557 + Y / 100 * -0.2040 + Z / 100 * 1.0570;
    return {
      r: clamp(Math.round(linearToSrgb(Rlin) * 255)),
      g: clamp(Math.round(linearToSrgb(Glin) * 255)),
      b: clamp(Math.round(linearToSrgb(Blin) * 255))
    };
  }

  // ── Border Detection ─────────────────────────────────────

  function estimateBorderMargins(w, h, data) {
    var stripX = Math.max(1, Math.floor(w * 0.05));
    var stripY = Math.max(1, Math.floor(h * 0.05));

    function stripMetrics(x0, y0, x1, y1) {
      var n = 0, sSum = 0, nearBW = 0;
      for (var y = y0; y < y1; y++) {
        for (var x = x0; x < x1; x++) {
          var idx = (y * w + x) * 4;
          var r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
          if (a < 128) continue;
          var hsv = rgbToHsv(r, g, b);
          sSum += hsv.s;
          if (isIgnorableColor(r, g, b)) nearBW++;
          n++;
        }
      }
      var sAvg = n ? sSum / n : 0;
      var bwRatio = n ? nearBW / n : 1;
      return { sAvg: sAvg, bwRatio: bwRatio };
    }

    var top = stripMetrics(0, 0, w, stripY);
    var bottom = stripMetrics(0, h - stripY, w, h);
    var left = stripMetrics(0, 0, stripX, h);
    var right = stripMetrics(w - stripX, 0, w, h);

    var mTop    = (top.sAvg < 0.1 || top.bwRatio > 0.6)      ? Math.floor(h * 0.08) : 0;
    var mBottom = (bottom.sAvg < 0.1 || bottom.bwRatio > 0.6) ? Math.floor(h * 0.08) : 0;
    var mLeft   = (left.sAvg < 0.1 || left.bwRatio > 0.6)     ? Math.floor(w * 0.08) : 0;
    var mRight  = (right.sAvg < 0.1 || right.bwRatio > 0.6)   ? Math.floor(w * 0.08) : 0;

    return { mTop: mTop, mBottom: mBottom, mLeft: mLeft, mRight: mRight };
  }

  // ── K-Means++ Initialization ─────────────────────────────

  function initCentersKMeansPP(points, k) {
    var cs = [];
    if (points.length === 0) return cs;

    var maxW = -1, maxIdx = 0;
    for (var i = 0; i < points.length; i++) {
      if (points[i].w > maxW) { maxW = points[i].w; maxIdx = i; }
    }
    cs.push(points[maxIdx].lab);

    while (cs.length < k) {
      var dists = points.map(function (p) {
        var minD = Infinity;
        var s = p.lab;
        for (var j = 0; j < cs.length; j++) {
          var c = cs[j];
          var d = (s.L - c.L) * (s.L - c.L) + (s.a - c.a) * (s.a - c.a) + (s.b - c.b) * (s.b - c.b);
          if (d < minD) minD = d;
        }
        return minD;
      });
      var sum = dists.reduce(function (a, b) { return a + b; }, 0);
      var r = Math.random() * sum;
      var idx = 0;
      for (var i = 0; i < dists.length; i++) {
        r -= dists[i];
        if (r <= 0) { idx = i; break; }
      }
      cs.push(points[idx].lab);
    }
    return cs;
  }

  // ── Main: Extract Dominant Color ─────────────────────────
  // data: flat RGBA array (Uint8Array or similar), w: width, h: height
  // Returns { r, g, b }

  function extractDominantColor(data, w, h) {
    var samples = [];
    var margins = estimateBorderMargins(w, h, data);
    var hueBins = new Array(36).fill(0);

    for (var i = 0; i < data.length; i += 4) {
      var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 128) continue;

      var idxPix = i / 4;
      var y = Math.floor(idxPix / w);
      var x = idxPix % w;
      if (y < margins.mTop || y >= h - margins.mBottom || x < margins.mLeft || x >= w - margins.mRight) continue;
      if (isIgnorableColor(r, g, b)) continue;

      var hsv = rgbToHsv(r, g, b);
      var wgt = Math.pow(hsv.s, 1.2) * (hsv.v > 0.5 ? 1 : 0.7);
      if (hsv.s < 0.05 || hsv.v < 0.15) continue;

      samples.push({ r: r, g: g, b: b, lab: rgbToLab(r, g, b), w: wgt, h: hsv.h });
      var bin = Math.floor(hsv.h / 10);
      hueBins[bin] += wgt;
    }

    if (samples.length === 0) return { r: 200, g: 200, b: 200 };

    var totalWeight = samples.reduce(function (sum, s) { return sum + s.w; }, 0);

    // Fast path: if one hue clearly dominates, average that band in CIELAB
    var peakIdx = hueBins.reduce(function (p, cur, i) { return cur > hueBins[p] ? i : p; }, 0);
    if (hueBins[peakIdx] / totalWeight > 0.2) {
      var peakHue = peakIdx * 10 + 5;
      var band = samples.filter(function (s) { return hsvDist(s.h, peakHue) <= 15; });
      var bandWeight = band.reduce(function (sum, s) { return sum + s.w; }, 0);
      if (bandWeight / totalWeight > 0.15) {
        var L = 0, A = 0, B = 0, W = 0;
        for (var j = 0; j < band.length; j++) {
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
    var k = 6;
    var centers = initCentersKMeansPP(samples, k).map(function (c) {
      return { L: c.L, a: c.a, b: c.b, w: 0 };
    });
    var maxIter = 10;
    var assignments = new Int32Array(samples.length);

    for (var iter = 0; iter < maxIter; iter++) {
      for (var i = 0; i < samples.length; i++) {
        var best = 0, bestDist = Infinity;
        var s = samples[i].lab;
        for (var c = 0; c < centers.length; c++) {
          var cc = centers[c];
          var d = (s.L - cc.L) * (s.L - cc.L) + (s.a - cc.a) * (s.a - cc.a) + (s.b - cc.b) * (s.b - cc.b);
          if (d < bestDist) { bestDist = d; best = c; }
        }
        assignments[i] = best;
      }
      var acc = centers.map(function () { return { L: 0, a: 0, b: 0, w: 0 }; });
      for (var i = 0; i < samples.length; i++) {
        var s = samples[i].lab;
        var idx = assignments[i];
        var wgt = samples[i].w;
        acc[idx].L += s.L * wgt;
        acc[idx].a += s.a * wgt;
        acc[idx].b += s.b * wgt;
        acc[idx].w += wgt;
      }
      for (var c = 0; c < centers.length; c++) {
        if (acc[c].w > 0) {
          centers[c] = { L: acc[c].L / acc[c].w, a: acc[c].a / acc[c].w, b: acc[c].b / acc[c].w, w: 0 };
        }
      }
    }

    var finalWeights = new Array(centers.length).fill(0);
    for (var i = 0; i < assignments.length; i++) finalWeights[assignments[i]] += samples[i].w;
    var order = centers.map(function (_, i) { return i; }).sort(function (a, b) { return finalWeights[b] - finalWeights[a]; });

    for (var j = 0; j < order.length; j++) {
      var rgb = labToRgb(centers[order[j]].L, centers[order[j]].a, centers[order[j]].b);
      if (!isNearBlackWhite(rgb.r, rgb.g, rgb.b)) return rgb;
    }
    return labToRgb(centers[order[0]].L, centers[order[0]].a, centers[order[0]].b);
  }

  // ── Normalize for White Text Contrast ────────────────────
  // Darkens a color so white text on it meets the given contrast ratio.

  function normalizeForWhiteContrast(r, g, b, targetL, minRatio) {
    if (targetL === undefined) targetL = 0.10;
    if (minRatio === undefined) minRatio = 6.0;

    var Rlin = srgbToLinear(r), Glin = srgbToLinear(g), Blin = srgbToLinear(b);
    var L = 0.2126 * Rlin + 0.7152 * Glin + 0.0722 * Blin;
    var Lmax = Math.max(0, Math.min(1, (1.05 / minRatio) - 0.05));
    var desired = Math.min(targetL, Lmax);

    if (L === 0) {
      Rlin = desired; Glin = desired; Blin = desired;
    } else {
      var k = desired / L;
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

  function contrastWithWhite(r, g, b) {
    var L = luminance(r, g, b);
    return (1.0 + 0.05) / (L + 0.05);
  }

  // ── Public API ─────────────────────────────────────────

  return {
    extractDominantColor: extractDominantColor,
    normalizeForWhiteContrast: normalizeForWhiteContrast,
    contrastWithWhite: contrastWithWhite,
    rgbToHex: rgbToHex
  };

})();
