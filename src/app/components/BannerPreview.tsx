import React, { useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Move, Download, ZoomIn, ZoomOut, FlipHorizontal2, RotateCcw, ShieldAlert, Check, Type } from 'lucide-react';
import { hslToRgb, normalizeForWhiteContrast } from '../utils/tint-sync';
import { validateTitle, validateSubtitle, validateButtonText } from '../utils/content-rules';
import { StatusPill } from './StatusPill';
import { ExportBlockedCard } from './ExportBlockedCard';
import { BannerDetails } from './BannerDetails';
import type { StatusPillData } from './StatusPill';

import { LANGUAGES } from './Generator';
import type { LangCode } from './Generator';

interface Transform {
  posX: number;
  posY: number;
  scale: number;
  flipX: boolean;
}

// ── Canvas-based text measurement ──────────────────────
let _measureCanvas: HTMLCanvasElement | null = null;
function measureTextWidth(text: string, fontSizePx: number, letterSpacingEm: number): number {
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const ctx = _measureCanvas.getContext('2d')!;
  ctx.font = `700 ${fontSizePx}px Barlow, sans-serif`;
  const baseWidth = ctx.measureText(text).width;
  const spacingPx = fontSizePx * letterSpacingEm;
  const totalSpacing = Math.max(0, text.length - 1) * spacingPx;
  return baseWidth + totalSpacing;
}

const TITLE_MIN_FONT = 40;
const TITLE_LETTER_SPACING = 0; // em (Barlow uses default tracking)

export function BannerPreview({ format, config, transform, imageSize, onTransformChange, onExport, onApplySuggestion, onSelectPaletteColor, filledLangs, enabledExportLangs, onToggleExportLang, activeLang }: any) {
  const { id, name, width, height, gradientHeight, topBlocked, leftBlocked, rightBlocked, titleChars, subtitleChars, maxTitleFont, centerContent, device, textInset, customBlocked, customSafeArea, subtitleFont, bottomInset, gradientStart, textAlign } = format;
  const { image, title, subtitle, buttonText, showSafeAreas, baseColor, exportMode } = config;
  const palette = config.palette || [];
  const selectedPaletteIndex = config.selectedPaletteIndex ?? 0;
  const { posX, posY, scale, flipX } = transform as Transform;

  const [isDragging, setIsDragging] = useState(false);
  const [showExportBlocked, setShowExportBlocked] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [resetSpin, setResetSpin] = useState(0);
  const dragStart = useRef<{ x: number; y: number; startPosX: number; startPosY: number } | null>(null);
  const scrubRef = useRef<{ axis: 'x' | 'y'; startClientX: number; startVal: number } | null>(null);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Brief flash for zoom button clicks; slider uses pointer events for sustained show
  const flashZoomGuides = useCallback(() => {
    setIsZooming(true);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setIsZooming(false), 200);
  }, []);

  const guidesVisible = showSafeAreas || isDragging || isZooming;

  const SCALE_MIN = 50;
  const SCALE_MAX = 150;

  // ── Dynamic gradient stopping point ────────────────────
  // Default: 0% solid hold (pure gradient fade).
  // When the image is dragged to expose a gap on the leading edge
  // (left on desktop, bottom on mobile), the solid-color hold ramps up
  // proportionally toward gradientStart (default 40%) to cover the gap.
  const effectiveGradientStart = useMemo(() => {
    const maxHold = gradientStart ?? 40;
    if (!image || !imageSize) return 0;
    const zoom = scale / 100;
    const coverScale = Math.max(width / imageSize.w, height / imageSize.h) * zoom;
    const imgW = imageSize.w * coverScale;
    const imgH = imageSize.h * coverScale;
    const overflowX = imgW - width;
    const overflowY = imgH - height;

    if (device === 'desktop' || centerContent) {
      // Check left edge gap (free-pan X: panRangeX allows movement even with no overflow)
      const panRangeX = width;
      const effectiveOverflowX = overflowX + panRangeX;
      const imgLeft = -(posX / 100) * effectiveOverflowX + panRangeX / 2;
      if (imgLeft > 0) {
        const gradientW = width * 0.5;
        const gapPct = (imgLeft / gradientW) * 100;
        return Math.min(100, gapPct);
      }
    } else {
      // Mobile: check bottom edge gap
      const panRangeY = height;
      const effectiveOverflowY = overflowY + panRangeY;
      const imgTop = -(posY / 100) * effectiveOverflowY + panRangeY / 2;
      const imgBottom = imgTop + imgH;
      const gap = height - imgBottom;
      if (gap > 0) {
        const gapPct = (gap / gradientHeight) * 100;
        return Math.min(100, gapPct);
      }
    }
    return 0;
  }, [image, imageSize, scale, posX, posY, width, height, gradientHeight, gradientStart, device, centerContent]);

  const previewScale = 0.32;
  const previewWidth = width * previewScale;
  const previewHeight = height * previewScale;

  const getFontSize = (baseSize: number) => `${baseSize}px`;
  const isDesktop = device === 'desktop';

  // ── Auto-fit title font size ─────────────────────────
  const titleFontSize = useMemo(() => {
    if (!title) return maxTitleFont;
    const padLeft = textInset ?? (leftBlocked > 0 ? leftBlocked + 60 : 40);
    const padRight = textInset ?? (rightBlocked > 0 ? rightBlocked + 60 : 40);
    const fullAvailable = width - padLeft - padRight;
    // Desktop: title must not exceed 60% of banner width
    const availableWidth = isDesktop ? Math.min(fullAvailable, width * 0.6) : fullAvailable;
    let lo = TITLE_MIN_FONT;
    let hi = maxTitleFont;
    if (measureTextWidth(title, hi, TITLE_LETTER_SPACING) <= availableWidth) return hi;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (measureTextWidth(title, mid, TITLE_LETTER_SPACING) <= availableWidth) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  }, [title, maxTitleFont, width, leftBlocked, rightBlocked, textInset, isDesktop]);

  // ── Compute title rendered width for subtitle constraint (desktop) ──
  const titleRenderedWidth = useMemo(() => {
    if (!title) return undefined;
    return measureTextWidth(title, titleFontSize, TITLE_LETTER_SPACING);
  }, [title, titleFontSize]);

  const gradientRgb = hslToRgb(baseColor.h, baseColor.s, baseColor.l);
  const normRgb = normalizeForWhiteContrast(gradientRgb.r, gradientRgb.g, gradientRgb.b, 0.10, 6.0);
  const startColor = `rgba(${normRgb.r}, ${normRgb.g}, ${normRgb.b}, 1.0)`;
  const endColor = `rgba(${normRgb.r}, ${normRgb.g}, ${normRgb.b}, 0)`;

  // ── Per-format status pills ──────────────────────────

  const statusPills: StatusPillData[] = useMemo(() => {
    const pills: StatusPillData[] = [];

    // — Title checks —
    const titleWarnings = validateTitle(title, activeLang);
    const titleOverLength = title.length > titleChars;
    if (titleWarnings.length > 0 || titleOverLength) {
      const worst = titleWarnings.find(w => w.severity === 'error') || titleWarnings[0];
      const severity = titleWarnings.some(w => w.severity === 'error') || titleOverLength ? 'error' : 'warning';
      const messages: string[] = titleWarnings.map(w => w.message);
      if (titleOverLength) messages.push(`${title.length}/${titleChars} characters (over by ${title.length - titleChars})`);
      pills.push({
        id: `title-${id}`,
        label: 'Title',
        severity: severity as any,
        headline: severity === 'error' ? 'Title has errors' : 'Title needs attention',
        details: messages.join(' · '),
        suggestion: worst?.suggestion,
        onFix: worst?.suggestion ? () => onApplySuggestion?.('title', worst.suggestion!) : undefined,
      });
    } else {
      pills.push({
        id: `title-${id}`,
        label: 'Title',
        severity: 'success',
        headline: 'Title looks good',
        details: `${title.length}/${titleChars} characters`,
      });
    }

    // — Subtitle checks —
    const subWarnings = validateSubtitle(subtitle, activeLang);
    const subOverLength = subtitle.length > subtitleChars;
    if (subWarnings.length > 0 || subOverLength) {
      const worst = subWarnings.find(w => w.severity === 'error') || subWarnings[0];
      const severity = subWarnings.some(w => w.severity === 'error') || subOverLength ? 'error' : 'warning';
      const messages: string[] = subWarnings.map(w => w.message);
      if (subOverLength) messages.push(`${subtitle.length}/${subtitleChars} characters (over by ${subtitle.length - subtitleChars})`);
      pills.push({
        id: `subtitle-${id}`,
        label: 'Subtitle',
        severity: severity as any,
        headline: severity === 'error' ? 'Subtitle has errors' : 'Subtitle needs attention',
        details: messages.join(' · '),
        suggestion: worst?.suggestion,
        onFix: worst?.suggestion ? () => onApplySuggestion?.('subtitle', worst.suggestion!) : undefined,
      });
    } else {
      pills.push({
        id: `subtitle-${id}`,
        label: 'Subtitle',
        severity: 'success',
        headline: 'Subtitle looks good',
        details: subtitle ? `${subtitle.length}/${subtitleChars} characters` : 'No subtitle set',
      });
    }

    // — Button checks (desktop only — mobile banners have no button) —
    if (isDesktop) {
      const btnWarnings = validateButtonText(buttonText, activeLang);
      if (btnWarnings.length > 0) {
        const worst = btnWarnings.find(w => w.severity === 'error') || btnWarnings[0];
        const severity = btnWarnings.some(w => w.severity === 'error') ? 'error' : 'warning';
        const messages: string[] = btnWarnings.map(w => w.message);
        pills.push({
          id: `button-${id}`,
          label: 'Button',
          severity: severity as any,
          headline: severity === 'error' ? 'Button text has errors' : 'Button text needs attention',
          details: messages.join(' · '),
          suggestion: worst?.suggestion,
          onFix: worst?.suggestion ? () => onApplySuggestion?.('button', worst.suggestion!) : undefined,
        });
      } else {
        pills.push({
          id: `button-${id}`,
          label: 'Button',
          severity: 'success',
          headline: 'Button text looks good',
          details: buttonText ? `"${buttonText}"` : 'No button text set',
        });
      }
    }

    // — Color dominance check —
    if (palette.length > 0 && palette[selectedPaletteIndex]) {
      const pct = Math.round(palette[selectedPaletteIndex].weight * 100);
      if (pct < 10) {
        const topPct = Math.round(palette[0].weight * 100);
        pills.push({
          id: `color-${id}`,
          label: 'Colour',
          severity: 'warning',
          headline: 'Low colour dominance',
          details: `Selected colour (${palette[selectedPaletteIndex].hex}) represents only ${pct}% of the image. The gradient may not blend naturally with the background.`,
          fixLabel: 'Fix',
          onFix: () => onSelectPaletteColor?.(0),
        });
      } else {
        pills.push({
          id: `color-${id}`,
          label: 'Colour',
          severity: 'success',
          headline: 'Colour dominance is good',
          details: `Selected colour (${palette[selectedPaletteIndex].hex}) represents ${pct}% of the image.`,
        });
      }
    }

    // — Frame coverage check —
    if (image && imageSize) {
      const zoom = scale / 100;
      const coverScale = Math.max(width / imageSize.w, height / imageSize.h) * zoom;
      const imgW = imageSize.w * coverScale;
      const imgH = imageSize.h * coverScale;
      const overflowX = imgW - width;
      const overflowY = imgH - height;
      const panRangeX = width;
      const effectiveOverflowX = overflowX + panRangeX;
      const imgLeft = -(posX / 100) * effectiveOverflowX + panRangeX / 2;
      const panRangeY = height;
      const effectiveOverflowY = overflowY + panRangeY;
      const imgTop = -(posY / 100) * effectiveOverflowY + panRangeY / 2;
      const imgRight = imgLeft + imgW;
      const imgBottom = imgTop + imgH;

      const gapLeft = Math.max(0, imgLeft);
      const gapTop = Math.max(0, imgTop);
      const gapRight = Math.max(0, width - imgRight);
      const gapBottom = Math.max(0, height - imgBottom);

      // Desktop: ignore left edge (gradient covers it). Mobile: bottom edge uses gradient-proximity check.
      const isDesktopMode = device === 'desktop' || centerContent;
      const relevantGaps: string[] = [];
      if (!isDesktopMode && gapLeft > 1) relevantGaps.push('left');
      if (gapRight > 1) relevantGaps.push('right');
      if (gapTop > 1) relevantGaps.push('top');
      if (isDesktopMode && gapBottom > 1) relevantGaps.push('bottom');

      // Desktop: warn when the image left edge is about to exit the gradient area on X axis
      // (the gradient still looks good until ~40% before the image leaves the zone)
      const gradientW = Math.round(width * 0.5);
      if (isDesktopMode) {
        const distIntoGradient = gradientW - imgLeft; // how far imgLeft penetrates into gradient zone from its right boundary
        if (distIntoGradient < gradientW * 0.40) {
          relevantGaps.push('left');
        }
      }

      // Mobile: warn when the image bottom edge is about to exit the gradient area on Y axis
      // (the gradient still looks good until ~40% before the image leaves the zone)
      if (!isDesktopMode) {
        const gradientTop = height - gradientHeight;
        const distFromGradientTop = imgBottom - gradientTop;
        if (distFromGradientTop < gradientHeight * 0.40) {
          relevantGaps.push('bottom');
        }
      }

      if (relevantGaps.length > 0) {
        // Minimal-adjustment fix: find the smallest change to posX, posY, and scale
        // that resolves all detected coverage issues while preserving user positioning.
        const fixFn = () => {
          const prX = width; // panRangeX

          // For each candidate scale (starting from current), compute valid posX/posY
          // ranges that satisfy all edge constraints, then pick the closest point to
          // the user's current (posX, posY).
          for (let s = scale; s <= SCALE_MAX; s++) {
            const z = s / 100;
            const cs = Math.max(width / imageSize.w, height / imageSize.h) * z;
            const iW = imageSize.w * cs;
            const iH = imageSize.h * cs;
            const oX = iW - width;
            const oY = iH - height;
            const eOX = oX + prX;
            const prY = height; // panRangeY
            const eOY = oY + prY;

            // Start with fully open ranges
            let minPX = -Infinity, maxPX = Infinity;
            let minPY = -Infinity, maxPY = Infinity;
            let impossible = false;

            // ── X-axis constraints ──
            // 'left': depends on mode
            if (relevantGaps.includes('left')) {
              if (isDesktopMode) {
                // Desktop gradient proximity: imgLeft must be ≤ gradientW * 0.60
                // imgLeft = -(px/100)*eOX + prX/2 ≤ gW*0.60
                // px ≥ (prX/2 - gW*0.60) / eOX * 100
                const gW = Math.round(width * 0.5);
                if (eOX <= 0) { impossible = true; }
                else { minPX = Math.max(minPX, (prX / 2 - gW * 0.60) / eOX * 100); }
              } else {
                // Mobile: imgLeft <= 0 → px >= (prX/2) / eOX * 100
                if (eOX <= 0) { impossible = true; } 
                else { minPX = Math.max(minPX, (prX / 2) / eOX * 100); }
              }
            }
            // 'right': imgRight >= width → px <= (prX/2 + oX) / eOX * 100
            if (relevantGaps.includes('right')) {
              if (eOX <= 0) { impossible = true; }
              else { maxPX = Math.min(maxPX, (prX / 2 + oX) / eOX * 100); }
            }

            // ── Y-axis constraints ──
            // With panRangeY: imgTop = -(py/100)*eOY + prY/2
            // 'top': imgTop <= 0 → py >= (prY/2) / eOY * 100
            if (relevantGaps.includes('top')) {
              if (eOY <= 0) { impossible = true; }
              else { minPY = Math.max(minPY, (prY / 2) / eOY * 100); }
            }
            // 'bottom': depends on mode
            if (relevantGaps.includes('bottom')) {
              if (isDesktopMode) {
                // imgBottom >= height → imgTop + iH >= height → py <= (prY/2 + oY) / eOY * 100
                if (eOY <= 0) { impossible = true; }
                else { maxPY = Math.min(maxPY, (prY / 2 + oY) / eOY * 100); }
              } else {
                // Mobile gradient proximity: imgBottom >= targetBottom
                const targetBottom = (height - gradientHeight) + gradientHeight * 0.40;
                // -(py/100)*eOY + prY/2 + iH >= targetBottom → py <= (prY/2 + iH - targetBottom) / eOY * 100
                if (eOY <= 0) {
                  if (iH < targetBottom) { impossible = true; }
                } else {
                  maxPY = Math.min(maxPY, (prY / 2 + iH - targetBottom) / eOY * 100);
                }
              }
            }

            if (impossible || minPX > maxPX || minPY > maxPY) continue;

            // Clamp current position to the valid ranges → minimal movement
            const fixPX = Math.max(minPX, Math.min(maxPX, posX));
            const fixPY = Math.max(minPY, Math.min(maxPY, posY));

            // Build the minimal update — only include changed properties
            const update: Record<string, number> = {};
            if (s !== scale) update.scale = s;
            if (Math.abs(fixPX - posX) > 0.05) update.posX = Math.round(fixPX * 10) / 10;
            if (Math.abs(fixPY - posY) > 0.05) update.posY = Math.round(fixPY * 10) / 10;
            onTransformChange(update);
            return;
          }
          // Fallback: max scale, keep position
          onTransformChange({ scale: SCALE_MAX });
        };

        // Tailor the message for gradient-proximity warnings
        const isBottomGradientWarning = !isDesktopMode && relevantGaps.includes('bottom') && gapBottom <= 1;
        const isLeftGradientWarning = isDesktopMode && relevantGaps.includes('left') && gapLeft <= 1;
        const isGradientOnly = (isBottomGradientWarning || isLeftGradientWarning) && relevantGaps.length === 1;
        const headline = isGradientOnly
          ? 'Image is leaving the gradient zone'
          : 'Image doesn\'t fill the frame';
        const details = isGradientOnly
          ? (isLeftGradientWarning
            ? 'The image left edge is about to exit the gradient area. The gradient effect may not blend naturally.'
            : 'The image bottom edge is about to exit the gradient area. The gradient effect may not blend naturally.')
          : `The background colour is visible on the ${relevantGaps.join(', ')} edge${relevantGaps.length > 1 ? 's' : ''}. Adjust position or zoom to cover the full frame.`;

        pills.push({
          id: `coverage-${id}`,
          label: 'Coverage',
          severity: 'warning',
          headline,
          details,
          fixLabel: 'Fix',
          onFix: fixFn,
        });
      } else {
        pills.push({
          id: `coverage-${id}`,
          label: 'Coverage',
          severity: 'success',
          headline: 'Image fills the frame',
          details: 'The image fully covers all required edges at the current position and zoom.',
        });
      }
    }

    // — Resolution check —
    if (image && imageSize) {
      const zoomFactor = scale / 100;
      const neededW = width * zoomFactor;
      const neededH = height * zoomFactor;
      const coverScale = Math.max(neededW / imageSize.w, neededH / imageSize.h);
      if (coverScale > 1) {
        const pct = Math.round((1 / coverScale) * 100);
        if (pct < 50) {
          pills.push({
            id: `resolution-${id}`,
            label: 'Resolution',
            severity: 'error',
            headline: 'Image resolution too low',
            details: `Image is ${imageSize.w}×${imageSize.h}px but ${name} needs ${Math.round(neededW)}×${Math.round(neededH)}px. Effective coverage: ${pct}%.`,
          });
        }
      }
    }

    return pills;
  }, [id, title, subtitle, buttonText, titleChars, subtitleChars, width, height, image, imageSize, scale, posX, posY, onApplySuggestion, onTransformChange, palette, selectedPaletteIndex, onSelectPaletteColor, device, centerContent, gradientHeight, name, activeLang]);

  // ── Drag to pan ──────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!image) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, startPosX: posX, startPosY: posY };
  }, [image, posX, posY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Per-axis 1:1 screen-pixel sensitivity
    // X has inflated effective range (overflowX + panRangeX), so we compensate
    if (imageSize) {
      const zoom = scale / 100;
      const coverScale = Math.max(width / imageSize.w, height / imageSize.h) * zoom;
      const imgW = imageSize.w * coverScale;
      const imgH = imageSize.h * coverScale;
      const rawOverflowX = imgW - width;
      const overflowY = imgH - height;
      const panRangeX = width;
      const effectiveOverflowX = rawOverflowX + panRangeX;
      const sensX = effectiveOverflowX > 0 ? 100 / (effectiveOverflowX * previewScale) : 0;
      const panRangeY = height;
      const effectiveOverflowY = overflowY + panRangeY;
      const sensY = effectiveOverflowY > 0 ? 100 / (effectiveOverflowY * previewScale) : 0;
      const newPosX = dragStart.current.startPosX - dx * sensX;
      const newPosY = dragStart.current.startPosY - dy * sensY;
      onTransformChange({ posX: Math.round(newPosX * 10) / 10, posY: Math.round(newPosY * 10) / 10 });
    } else {
      const sens = 100 / previewHeight;
      const newPosX = dragStart.current.startPosX - dx * sens;
      const newPosY = dragStart.current.startPosY - dy * sens;
      onTransformChange({ posX: Math.round(newPosX * 10) / 10, posY: Math.round(newPosY * 10) / 10 });
    }
  }, [isDragging, previewHeight, previewScale, onTransformChange, imageSize, scale, width, height]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  // ── Scrub-to-adjust position values ──────────────────
  const handleScrubDown = useCallback((e: React.PointerEvent, axis: 'x' | 'y') => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    scrubRef.current = { axis, startClientX: e.clientX, startVal: axis === 'x' ? posX : posY };
  }, [posX, posY]);

  const handleScrubMove = useCallback((e: React.PointerEvent) => {
    if (!scrubRef.current) return;
    const dx = e.clientX - scrubRef.current.startClientX;
    if (scrubRef.current.axis === 'x' && imageSize) {
      // Scale X scrub sensitivity to match Y visual feel
      const zoom = scale / 100;
      const coverScale = Math.max(width / imageSize.w, height / imageSize.h) * zoom;
      const imgW = imageSize.w * coverScale;
      const imgH = imageSize.h * coverScale;
      const rawOverflowX = imgW - width;
      const overflowY = imgH - height;
      const panRangeX = width;
      const effectiveOverflowX = rawOverflowX + panRangeX;
      // Match the visual pixel-per-scrub-pixel rate of Y axis
      const yRange = Math.max(overflowY, height); // fallback to height if no Y overflow
      const ratio = yRange / effectiveOverflowX;
      const newVal = scrubRef.current.startVal - dx * 0.5 * ratio;
      onTransformChange({ posX: Math.round(newVal * 10) / 10 });
    } else {
      // Y axis: unchanged
      const newVal = scrubRef.current.startVal + dx * 0.5;
      const rounded = Math.round(newVal * 10) / 10;
      if (scrubRef.current.axis === 'x') {
        onTransformChange({ posX: rounded });
      } else {
        onTransformChange({ posY: rounded });
      }
    }
  }, [onTransformChange, imageSize, scale, width, height]);

  const handleScrubUp = useCallback(() => {
    scrubRef.current = null;
  }, []);

  const handleReset = () => {
    onTransformChange({ posX: 50, posY: 50, scale: 100, flipX: false });
    setResetSpin(prev => prev + 1);
  };

  const isDefault = posX === 50 && posY === 50 && scale === 100 && !flipX;

  const errorPills = statusPills.filter(p => p.severity === 'error');
  const hasErrors = errorPills.length > 0;

  const handleExportClick = () => {
    if (hasErrors) {
      setShowExportBlocked(true);
    } else {
      const node = document.getElementById(`export-node-${id}`);
      onExport(node).then(() => {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 1800);
      }).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col gap-4 mb-10 overflow-x-auto pb-4">
      {/* Header row: title + status pills + export */}
      <div className="flex items-start justify-between px-2 min-w-max gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-[20px] font-semibold tracking-tight text-[#1d1d1f] flex-shrink-0">{name}</h3>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6e6e73] bg-black/[0.04] rounded-full px-2 py-0.5 flex-shrink-0"
              title="Title, subtitle and CTA are live text added by the page builder on the customer side. The exported image contains the background and gradient only — this preview shows how it will look composited."
            >
              <Type size={11} strokeWidth={2.5} />
              Live text · not in export
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusPills.map(pill => (
                <StatusPill key={pill.id} data={pill} />
              ))}
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <BannerDetails device={device} placement={format.placement} width={width} height={height} />
            {format.deprecated && (() => {
              const cutoff = new Date('2026-03-15T23:59:59');
              const isExpired = new Date() > cutoff;
              return (
                <>
                  <span className="text-[15px] text-[#b0b0b5]">•</span>
                  <span className={`text-[13px] font-medium ${isExpired ? 'text-[#ff3b30]' : 'text-[#ff9500]'}`}>
                    {isExpired ? 'Do not use after 15th Mar' : 'Use until 15th Mar 2026'}
                  </span>
                </>
              );
            })()}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <button
            onClick={handleExportClick}
            className={`active:scale-[0.97] transition-all flex items-center gap-1.5 text-[14px] font-medium px-4 py-2 rounded-full ${
              exportSuccess
                ? 'text-[#34c759] bg-[#34c759]/10'
                : hasErrors
                  ? 'text-[#ff3b30] bg-[#ff3b30]/10 hover:bg-[#ff3b30]/20'
                  : 'text-[#0071e3] bg-[#0071e3]/10 hover:bg-[#0071e3]/20'
            }`}
          >
            <AnimatePresence mode="wait">
              {exportSuccess ? (
                <motion.div
                  key="success"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                >
                  <Check size={16} strokeWidth={2.5} />
                </motion.div>
              ) : hasErrors ? (
                <motion.div key="error" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                  <ShieldAlert size={16} strokeWidth={2.5} />
                </motion.div>
              ) : (
                <motion.div key="download" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                  <Download size={16} strokeWidth={2.5} />
                </motion.div>
              )}
            </AnimatePresence>
            {exportSuccess ? 'Exported' : 'Export'}
          </button>
          {filledLangs && filledLangs.length > 0 && (
            <div className="flex items-center gap-1">
              {filledLangs.map((code: LangCode) => {
                const lang = LANGUAGES.find(l => l.code === code);
                const isEnabled = enabledExportLangs?.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => onToggleExportLang?.(code)}
                    className={`text-[11px] font-semibold rounded px-1.5 py-0.5 transition-all cursor-pointer ${
                      isEnabled
                        ? 'text-[#0071e3] bg-[#0071e3]/10 hover:bg-[#0071e3]/15'
                        : 'text-[#b0b0b5] bg-black/[0.03] hover:bg-black/[0.06] line-through'
                    }`}
                    title={isEnabled ? `Exclude ${lang?.name || code} from export` : `Include ${lang?.name || code} in export`}
                  >
                    {lang?.label || code}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div 
        className="relative overflow-hidden bg-white border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] inline-block group flex-shrink-0 select-none"
        style={{ width: previewWidth, height: previewHeight, minWidth: previewWidth, borderRadius: `${24 * previewScale}px`, cursor: image ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* The Actual Export Node */}
        <div 
          id={`export-node-${id}`}
          className="absolute top-0 left-0 bg-white overflow-hidden origin-top-left flex font-barlow pointer-events-none"
          style={{ 
            width: `${width}px`, 
            height: `${height}px`,
            transform: `scale(${previewScale})`,
          }}
        >
          {/* Background Image Container */}
          <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: image ? `rgb(${normRgb.r}, ${normRgb.g}, ${normRgb.b})` : '#e5e5ea' }}>
            {image ? (() => {
              // Manual cover-fit positioning for true X+Y panning
              const zoom = scale / 100;
              if (imageSize) {
                const coverScale = Math.max(width / imageSize.w, height / imageSize.h) * zoom;
                const imgW = imageSize.w * coverScale;
                const imgH = imageSize.h * coverScale;
                const overflowX = imgW - width;
                const overflowY = imgH - height;
                // Free-pan X: add virtual panning range so X-axis dragging works without zooming
                const panRangeX = width;
                const effectiveOverflowX = overflowX + panRangeX;
                const imgLeft = -(posX / 100) * effectiveOverflowX + panRangeX / 2;
                const panRangeY = height;
                const effectiveOverflowY = overflowY + panRangeY;
                const imgTop = -(posY / 100) * effectiveOverflowY + panRangeY / 2;
                return (
                  <img
                    src={image}
                    alt="Background"
                    className="absolute max-w-none"
                    draggable={false}
                    style={{
                      width: `${imgW}px`,
                      height: `${imgH}px`,
                      left: `${imgLeft}px`,
                      top: `${imgTop}px`,
                      transform: flipX ? 'scaleX(-1)' : undefined,
                    }}
                  />
                );
              }
              // Fallback before imageSize is measured
              return (
                <img
                  src={image}
                  alt="Background"
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                  style={{
                    objectPosition: `${posX}% ${posY}%`,
                    transform: `scale(${zoom}) ${flipX ? 'scaleX(-1)' : ''}`,
                  }}
                />
              );
            })() : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
                    linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
                    linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
                  `,
                  backgroundSize: '40px 40px',
                  backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px',
                  backgroundColor: '#f5f5f5',
                }}
              />
            )}
          </div>

          {/* Gradient Overlay */}
          <div 
            className="absolute z-10 pointer-events-none"
            style={isDesktop ? {
              top: 0,
              left: 0,
              width: `${Math.round(width * 0.5)}px`,
              height: `${height}px`,
              background: `linear-gradient(to right, ${startColor} ${effectiveGradientStart}%, ${endColor} 100%)`,
            } : {
              bottom: 0,
              left: 0,
              width: '100%',
              height: `${gradientHeight}px`,
              background: `linear-gradient(to top, ${startColor} ${effectiveGradientStart}%, ${endColor} 100%)`,
            }}
          />
          {/* Gradient Overlay (2nd layer – doubles intensity like Figma) */}
          <div 
            className="absolute z-10 pointer-events-none"
            style={isDesktop ? {
              top: 0,
              left: 0,
              width: `${Math.round(width * 0.5)}px`,
              height: `${height}px`,
              background: `linear-gradient(to right, ${startColor} ${effectiveGradientStart}%, ${endColor} 100%)`,
            } : {
              bottom: 0,
              left: 0,
              width: '100%',
              height: `${gradientHeight}px`,
              background: `linear-gradient(to top, ${startColor} ${effectiveGradientStart}%, ${endColor} 100%)`,
            }}
          />

          {/* Text Container — hidden during export (live text is overlaid by
              the page builder on the customer side), shown in preview so users
              see the true composited look. */}
          {!exportMode && (
          <div
            className={`absolute z-20 flex flex-col ${centerContent ? 'justify-center' : 'justify-end'} ${textAlign === 'center' ? 'items-center text-center' : ''}`}
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              paddingLeft: textInset ? `${textInset}px` : (leftBlocked > 0 ? `${leftBlocked + 60}px` : '40px'),
              paddingRight: textInset ? `${textInset}px` : (rightBlocked > 0 ? `${rightBlocked + 60}px` : '40px'),
              ...(centerContent
                ? { paddingTop: '40px', paddingBottom: '40px' }
                : { paddingBottom: bottomInset ? `${bottomInset}px` : `${gradientHeight * 0.57}px` }
              ),
            }}
          >
            <h1
              className="text-white whitespace-nowrap drop-shadow-lg font-barlow font-bold"
              style={{ fontSize: `${titleFontSize}px`, letterSpacing: '-0.02em', lineHeight: 1.15 }}
            >
              {title}
            </h1>

            {subtitle && (
              <p
                className={`mt-4 drop-shadow-md ${textAlign === 'center' ? 'font-barlow font-medium leading-tight' : (isDesktop ? 'text-white/95 font-medium' : 'text-white/95 font-normal leading-tight')}`}
                style={{
                  color: textAlign === 'center' ? '#e5e5e5' : undefined,
                  fontSize: subtitleFont ? `${subtitleFont}px` : (isDesktop ? '48px' : getFontSize(50)),
                  lineHeight: subtitleFont ? `${Math.round(subtitleFont * 1.25)}px` : (isDesktop ? '60px' : undefined),
                  fontFamily: (isDesktop || textAlign === 'center') ? "'Barlow', sans-serif" : undefined,
                  fontWeight: subtitleFont ? 500 : undefined,
                  maxWidth: isDesktop ? `${Math.round(width * 0.6)}px` : '85%',
                  wordBreak: 'break-word',
                  ...(!isDesktop ? {
                    whiteSpace: 'nowrap' as const,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  } : {}),
                }}
              >
                {subtitle}
              </p>
            )}
            
            {buttonText && isDesktop && (
              <div className="mt-8">
                <button 
                  className="bg-[#f5f6fa] text-[#1a1a1a] font-semibold font-barlow transition-transform"
                  style={isDesktop ? {
                    padding: '16px 48px',
                    fontSize: '36px',
                    lineHeight: '48px',
                    borderRadius: '8px',
                  } : { 
                    padding: '12px 36px',
                    fontSize: '42px',
                    lineHeight: '60px',
                    borderRadius: '12px',
                  }}
                >
                  {buttonText.charAt(0).toUpperCase() + buttonText.slice(1).toLowerCase()}
                </button>
              </div>
            )}
          </div>
          )}

          {/* Safe Area Guides — editing aids only; never rendered during
              export (must not be baked into the downloaded image). */}
          {!exportMode && (
          <div className="absolute inset-0 z-30 pointer-events-none transition-opacity duration-200" style={{ opacity: guidesVisible ? 1 : 0 }}>
            {/* Blocked zones */}
            {customBlocked ? (
              <>
                {customBlocked.map((block: { left: number; top: number; width: number; height: number }, i: number) => (
                  <div
                    key={`custom-blocked-${i}`}
                    className="absolute bg-red-500/25 border-[3px] border-red-500/80 border-dashed"
                    style={{ left: block.left, top: block.top, width: block.width, height: block.height }}
                  />
                ))}
              </>
            ) : (
              <>
                {topBlocked > 0 && (
                  <div 
                    className="absolute top-0 left-0 w-full bg-red-500/25 border-b-[3px] border-red-500/80 border-dashed" 
                    style={{ height: `${topBlocked}px` }}
                  />
                )}
                {leftBlocked > 0 && (
                  <div 
                    className="absolute top-0 left-0 h-full bg-red-500/25 border-r-[3px] border-red-500/80 border-dashed" 
                    style={{ width: `${leftBlocked}px` }}
                  />
                )}
                {rightBlocked > 0 && (
                  <div 
                    className="absolute top-0 right-0 h-full bg-red-500/25 border-l-[3px] border-red-500/80 border-dashed" 
                    style={{ width: `${rightBlocked}px` }}
                  />
                )}
              </>
            )}
            {/* Safe area */}
            {customSafeArea ? (
              <div 
                className="absolute border-[3px] border-[#34c759]/80 border-dashed bg-[#34c759]/15"
                style={{
                  top: customSafeArea.top,
                  bottom: customSafeArea.bottom,
                  left: customSafeArea.left,
                  right: customSafeArea.right,
                }}
              />
            ) : !customBlocked && (
              <div 
                className="absolute border-[3px] border-[#34c759]/80 border-dashed bg-[#34c759]/15"
                style={{
                  top: topBlocked,
                  bottom: 0,
                  left: leftBlocked,
                  right: rightBlocked
                }}
              />
            )}
            <div 
              className="absolute border-[3px] border-[#007aff]/80 border-dashed bg-[#007aff]/15"
              style={isDesktop ? {
                top: 0,
                left: 0,
                width: `${Math.round(width * 0.5)}px`,
                height: `${height}px`,
              } : {
                bottom: 0,
                left: 0,
                width: '100%',
                height: `${gradientHeight}px`,
              }}
            />
            {/* Guide Legend */}
            <div 
              className="absolute left-1/2 -translate-x-1/2 flex items-center bg-black/60 backdrop-blur-xl"
              style={{ zIndex: 50, bottom: '24px', gap: '28px', borderRadius: '999px', padding: '14px 36px' }}
            >
              <div className="flex items-center" style={{ gap: '10px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: 'rgba(239,68,68,0.5)', borderWidth: '3px', borderStyle: 'dashed', borderColor: 'rgba(239,68,68,0.8)', borderRadius: '4px' }} />
                <span className="text-white/90 font-medium whitespace-nowrap" style={{ fontSize: '32px' }}>Blocked</span>
              </div>
              <div className="flex items-center" style={{ gap: '10px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: 'rgba(0,122,255,0.4)', borderWidth: '3px', borderStyle: 'dashed', borderColor: 'rgba(0,122,255,0.8)', borderRadius: '4px' }} />
                <span className="text-white/90 font-medium whitespace-nowrap" style={{ fontSize: '32px' }}>Gradient</span>
              </div>
              <div className="flex items-center" style={{ gap: '10px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: 'rgba(52,199,89,0.3)', borderWidth: '3px', borderStyle: 'dashed', borderColor: 'rgba(52,199,89,0.8)', borderRadius: '4px' }} />
                <span className="text-white/90 font-medium whitespace-nowrap" style={{ fontSize: '32px' }}>Safe area</span>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Drag hint on hover */}
        {image && !isDragging && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="bg-black/50 backdrop-blur-xl text-white/80 text-[11px] font-medium px-3 py-1 rounded-full shadow-md">
              Drag to reposition
            </div>
          </div>
        )}
      </div>

      {/* ── Persistent Control Bar (below the preview) ──────── */}
      {image && (
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl px-4 py-2.5 shadow-sm" style={{ minWidth: previewWidth }}>
          <button
            className={`transition-colors p-0.5 flex-shrink-0 rounded-lg ${
              posX === 50 && posY === 50
                ? 'text-[#c7c7cc] cursor-default'
                : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
            }`}
            onClick={posX !== 50 || posY !== 50 ? () => onTransformChange({ posX: 50, posY: 50 }) : undefined}
            title="Centre image"
            disabled={posX === 50 && posY === 50}
          >
            <Move size={14} />
          </button>
          <div className="flex items-center gap-0.5 text-[12px] font-medium whitespace-nowrap tabular-nums select-none">
            <span className="text-[#b0b0b5] mr-0.5">X</span>
            <span
              className="text-[#86868b] hover:text-[#0071e3] rounded px-1 py-0.5 hover:bg-[#0071e3]/5 transition-colors inline-block text-right"
              style={{ cursor: 'ew-resize', width: '4ch' }}
              onPointerDown={(e) => handleScrubDown(e, 'x')}
              onPointerMove={handleScrubMove}
              onPointerUp={handleScrubUp}
              onPointerCancel={handleScrubUp}
            >
              {(() => {
                if (!imageSize) return '0';
                const zoom = scale / 100;
                const coverScale = Math.max(width / imageSize.w, height / imageSize.h) * zoom;
                const imgW = imageSize.w * coverScale;
                const overflowX = imgW - width;
                const panRangeX = width;
                const effectiveOverflowX = overflowX + panRangeX;
                return `${Math.round((posX / 100) * effectiveOverflowX - panRangeX / 2)}`;
              })()}
            </span>
            <span className="text-[#d0d0d5] mx-0.5">,</span>
            <span className="text-[#b0b0b5] mr-0.5">Y</span>
            <span
              className="text-[#86868b] hover:text-[#0071e3] rounded px-1 py-0.5 hover:bg-[#0071e3]/5 transition-colors inline-block text-right"
              style={{ cursor: 'ew-resize', width: '4ch' }}
              onPointerDown={(e) => handleScrubDown(e, 'y')}
              onPointerMove={handleScrubMove}
              onPointerUp={handleScrubUp}
              onPointerCancel={handleScrubUp}
            >
              {(() => {
                if (!imageSize) return '0';
                const zoom = scale / 100;
                const coverScale = Math.max(width / imageSize.w, height / imageSize.h) * zoom;
                const imgH = imageSize.h * coverScale;
                const overflowY = imgH - height;
                const panRangeY = height;
                const effectiveOverflowY = overflowY + panRangeY;
                return `${Math.round((posY / 100) * effectiveOverflowY - panRangeY / 2)}`;
              })()}
            </span>
          </div>
          <div className="w-px h-4 bg-black/[0.08]" />
          <button 
            className="text-[#86868b] hover:text-[#1d1d1f] transition-colors p-0.5 flex-shrink-0"
            onClick={() => { onTransformChange({ scale: Math.max(SCALE_MIN, scale - 10) }); flashZoomGuides(); }}
          >
            <ZoomOut size={15} />
          </button>
          <div className="relative flex-1 min-w-[80px] max-w-[140px] h-5 flex items-center">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] bg-[#e5e5ea] rounded-full" />
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-[4px] bg-[#0071e3]/40 rounded-full"
              style={{ width: `${((scale - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%` }}
            />
            {/* Midpoint tick at 100% */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-[2px] h-[10px] bg-black/[0.12] rounded-full pointer-events-none"
              style={{ left: `${((100 - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%` }}
            />
            <input
              type="range"
              min={SCALE_MIN}
              max={SCALE_MAX}
              value={scale}
              onChange={(e) => { onTransformChange({ scale: Number(e.target.value) }); flashZoomGuides(); }}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-white border-2 border-[#0071e3] rounded-full shadow-sm pointer-events-none"
              style={{ left: `calc(${((scale - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}% - 7px)` }}
            />
          </div>
          <button 
            className="text-[#86868b] hover:text-[#1d1d1f] transition-colors p-0.5 flex-shrink-0"
            onClick={() => { onTransformChange({ scale: Math.min(SCALE_MAX, scale + 10) }); flashZoomGuides(); }}
          >
            <ZoomIn size={15} />
          </button>
          <span className="text-[12px] text-[#1d1d1f] font-medium font-mono tabular-nums w-[40px] text-center">{scale}%</span>
          <div className="w-px h-4 bg-black/[0.08]" />
          <button 
            className={`transition-colors p-1 flex-shrink-0 rounded-lg ${
              flipX
                ? 'text-[#0071e3] bg-[#0071e3]/10 hover:bg-[#0071e3]/15'
                : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
            }`}
            onClick={() => onTransformChange({ flipX: !flipX })}
            title="Flip horizontally"
          >
            <motion.div
              animate={{ scaleX: flipX ? -1 : 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 400 }}
            >
              <FlipHorizontal2 size={14} />
            </motion.div>
          </button>
          <div className="flex-1" />
          <div className="w-px h-4 bg-black/[0.08]" />
          <button 
            className={`transition-colors p-1 flex-shrink-0 rounded-lg ${
              isDefault
                ? 'text-[#c7c7cc] cursor-default'
                : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
            }`}
            onClick={!isDefault ? handleReset : undefined}
            title="Reset position & scale"
            disabled={isDefault}
          >
            <motion.div
              key={resetSpin}
              animate={resetSpin > 0 ? { rotate: [0, -360] } : {}}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <RotateCcw size={14} />
            </motion.div>
          </button>
        </div>
      )}

      {/* Export blocked modal */}
      {showExportBlocked && (
        <ExportBlockedCard
          formatName={name}
          errors={errorPills}
          onClose={() => setShowExportBlocked(false)}
        />
      )}
    </div>
  );
}