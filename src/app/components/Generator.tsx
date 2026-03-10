import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import * as htmlToImage from 'html-to-image';
import JSZip from 'jszip';
import { Download, LayoutTemplate, ShieldAlert, Smartphone, Monitor, Eye, EyeOff, BookOpen } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { BannerPreview } from './BannerPreview';
import { ExportBlockedCard } from './ExportBlockedCard';
import { ExportProgressBanner } from './ExportProgressBanner';
import type { ExportProgress } from './ExportProgressBanner';
import { rgbToHsl, rgbToHex, extractColorPalette } from '../utils/tint-sync';
import { validateTitle, validateSubtitle, validateButtonText } from '../utils/content-rules';
import type { StatusPillData } from './StatusPill';
import type { PaletteEntry } from '../utils/tint-sync';
import { FORMATS } from '../formats';
import { translateAll } from '../utils/translate';
import { RateLimitError } from '../utils/translate';

export type LangCode = 'en' | 'zh' | 'nl' | 'fr' | 'de';
export const LANGUAGES: { code: LangCode; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'zh', label: '中文', name: 'Mandarin' },
  { code: 'nl', label: 'NL', name: 'Dutch' },
  { code: 'fr', label: 'FR', name: 'French' },
  { code: 'de', label: 'DE', name: 'German' },
];

const emptyLangMap = (): Record<LangCode, string> =>
  ({ en: '', zh: '', nl: '', fr: '', de: '' });

/** Compute error-severity pills for a given format + current state */
function getFormatErrors(
  format: typeof FORMATS[0],
  title: string,
  subtitle: string,
  buttonText: string,
  image: string | null,
  imageSize: { w: number; h: number } | null,
  scale: number,
  lang: string = 'en',
  onApplySuggestion?: (field: string, suggestion: string) => void,
): StatusPillData[] {
  const errors: StatusPillData[] = [];

  // Title
  const tw = validateTitle(title, lang);
  const titleOver = title.length > format.titleChars;
  if (tw.some(w => w.severity === 'error') || titleOver) {
    const worst = tw.find(w => w.severity === 'error') || tw[0];
    const msgs = tw.map(w => w.message);
    if (titleOver) msgs.push(`${title.length}/${format.titleChars} characters (over by ${title.length - format.titleChars})`);
    errors.push({
      id: `title-${format.id}`,
      label: 'Title',
      severity: 'error',
      headline: 'Title has errors',
      details: msgs.join(' · '),
      suggestion: worst?.suggestion,
      onFix: worst?.suggestion ? () => onApplySuggestion?.('title', worst.suggestion!) : undefined,
    });
  }

  // Subtitle
  const sw = validateSubtitle(subtitle, lang);
  const subOver = subtitle.length > format.subtitleChars;
  if (sw.some(w => w.severity === 'error') || subOver) {
    const worst = sw.find(w => w.severity === 'error') || sw[0];
    const msgs = sw.map(w => w.message);
    if (subOver) msgs.push(`${subtitle.length}/${format.subtitleChars} characters (over by ${subtitle.length - format.subtitleChars})`);
    errors.push({
      id: `subtitle-${format.id}`,
      label: 'Subtitle',
      severity: 'error',
      headline: 'Subtitle has errors',
      details: msgs.join(' · '),
      suggestion: worst?.suggestion,
      onFix: worst?.suggestion ? () => onApplySuggestion?.('subtitle', worst.suggestion!) : undefined,
    });
  }

  // Button (desktop formats only — mobile banners have no button)
  if (format.device === 'desktop') {
    const bw = validateButtonText(buttonText, lang);
    if (bw.some(w => w.severity === 'error')) {
      const worst = bw.find(w => w.severity === 'error') || bw[0];
      errors.push({
        id: `button-${format.id}`,
        label: 'Button',
        severity: 'error',
        headline: 'Button text has errors',
        details: bw.map(w => w.message).join(' · '),
        suggestion: worst?.suggestion,
        onFix: worst?.suggestion ? () => onApplySuggestion?.('button', worst.suggestion!) : undefined,
      });
    }
  }

  // Resolution
  if (image && imageSize) {
    const zoomFactor = scale / 100;
    const neededW = format.width * zoomFactor;
    const neededH = format.height * zoomFactor;
    const coverScale = Math.max(neededW / imageSize.w, neededH / imageSize.h);
    if (coverScale > 1) {
      const pct = Math.round((1 / coverScale) * 100);
      if (pct < 50) {
        errors.push({
          id: `resolution-${format.id}`,
          label: 'Resolution',
          severity: 'error',
          headline: 'Image resolution too low',
          details: `Image is ${imageSize.w}×${imageSize.h}px but ${format.name} needs ${Math.round(neededW)}×${Math.round(neededH)}px. Effective coverage: ${pct}%.`,
        });
      }
    }
  }

  return errors;
}

export function Generator() {
  const [selectedFormats, setSelectedFormats] = useState(FORMATS.map(f => f.id));
  const [image, setImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [mobileImage, setMobileImage] = useState<string | null>(null);
  const [mobileImageSize, setMobileImageSize] = useState<{ w: number; h: number } | null>(null);
  
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const [baseColor, setBaseColor] = useState({ h: 0, s: 0, l: 0 });
  const [extractedHex, setExtractedHex] = useState('#000000');
  const [normalizedHex, setNormalizedHex] = useState('#000000');
  const [palette, setPalette] = useState<PaletteEntry[]>([]);
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(0);

  // Mobile-specific TintSync state
  const [mobileBaseColor, setMobileBaseColor] = useState({ h: 0, s: 0, l: 0 });
  const [mobileExtractedHex, setMobileExtractedHex] = useState('#000000');
  const [mobileNormalizedHex, setMobileNormalizedHex] = useState('#000000');
  const [mobilePalette, setMobilePalette] = useState<PaletteEntry[]>([]);
  const [mobileSelectedPaletteIndex, setMobileSelectedPaletteIndex] = useState(0);

  const [formatTransforms, setFormatTransforms] = useState<Record<string, { posX: number; posY: number; scale: number; flipX: boolean }>>({});

  const getTransform = (formatId: string) => formatTransforms[formatId] ?? { posX: 50, posY: 50, scale: 100, flipX: false };
  const updateTransform = (formatId: string, patch: Partial<{ posX: number; posY: number; scale: number; flipX: boolean }>) => {
    setFormatTransforms(prev => ({
      ...prev,
      [formatId]: { ...getTransform(formatId), ...patch },
    }));
  };

  // Multi-language content maps
  const [titles, setTitles] = useState<Record<LangCode, string>>({ ...emptyLangMap(), en: 'Super deals today' });
  const [subtitles, setSubtitles] = useState<Record<LangCode, string>>({ ...emptyLangMap(), en: 'Up to 50% off on selected items' });
  const [buttonTexts, setButtonTexts] = useState<Record<LangCode, string>>({ ...emptyLangMap(), en: 'Shop now' });
  const [activeLang, setActiveLang] = useState<LangCode>('en');

  // Active-language convenience values
  const title = titles[activeLang];
  const subtitle = subtitles[activeLang];
  const buttonText = buttonTexts[activeLang];

  // Setters that update the active language's slot
  const setTitle = useCallback((v: string) => setTitles(prev => ({ ...prev, [activeLang]: v })), [activeLang]);
  const setSubtitle = useCallback((v: string) => setSubtitles(prev => ({ ...prev, [activeLang]: v })), [activeLang]);
  const setButtonText = useCallback((v: string) => setButtonTexts(prev => ({ ...prev, [activeLang]: v })), [activeLang]);

  // Which languages have content (title filled in)
  const filledLangs = useMemo(() => LANGUAGES.filter(l => titles[l.code].trim().length > 0).map(l => l.code), [titles]);

  // Which filled languages are enabled for export (toggleable per-lang)
  const [enabledExportLangs, setEnabledExportLangs] = useState<Set<LangCode>>(new Set());
  const prevFilledRef = useRef<LangCode[]>([]);

  // Auto-enable newly filled languages
  useEffect(() => {
    const prev = prevFilledRef.current;
    const newLangs = filledLangs.filter(l => !prev.includes(l));
    if (newLangs.length > 0) {
      setEnabledExportLangs(s => {
        const next = new Set(s);
        newLangs.forEach(l => next.add(l));
        return next;
      });
    }
    // Remove langs that are no longer filled
    setEnabledExportLangs(s => {
      const next = new Set(s);
      for (const l of next) {
        if (!filledLangs.includes(l)) next.delete(l);
      }
      return next.size !== s.size ? next : s;
    });
    prevFilledRef.current = filledLangs;
  }, [filledLangs]);

  const toggleExportLang = useCallback((lang: LangCode) => {
    setEnabledExportLangs(s => {
      const next = new Set(s);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  }, []);

  const [showExportAllBlocked, setShowExportAllBlocked] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'mobile' | 'desktop'>('all');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationLimitReached, setTranslationLimitReached] = useState(false);

  // Translate English content into the active (non-EN) language
  const handleTranslateFromEnglish = useCallback(async () => {
    if (activeLang === 'en' || isTranslating || translationLimitReached) return;
    const enTitle = titles.en;
    const enSubtitle = subtitles.en;
    const enButton = buttonTexts.en;
    if (!enTitle.trim()) return;

    setIsTranslating(true);
    try {
      const result = await translateAll(enTitle, enSubtitle, enButton, activeLang);
      setTitles(prev => ({ ...prev, [activeLang]: result.title }));
      setSubtitles(prev => ({ ...prev, [activeLang]: result.subtitle }));
      setButtonTexts(prev => ({ ...prev, [activeLang]: result.buttonText }));
    } catch (err) {
      if (err instanceof RateLimitError) {
        setTranslationLimitReached(true);
      } else {
        console.error('Translation failed', err);
      }
    } finally {
      setIsTranslating(false);
    }
  }, [activeLang, titles.en, subtitles.en, buttonTexts.en, isTranslating, translationLimitReached]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImage(url);
      const probe = new Image();
      probe.onload = () => setImageSize({ w: probe.naturalWidth, h: probe.naturalHeight });
      probe.src = url;
      runColorExtraction(url);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImageSize(null);
    setPalette([]);
    setSelectedPaletteIndex(0);
    setBaseColor({ h: 0, s: 0, l: 0 });
    setExtractedHex('#000000');
    setNormalizedHex('#000000');
  };

  const handleMobileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMobileImage(url);
      const probe = new Image();
      probe.onload = () => setMobileImageSize({ w: probe.naturalWidth, h: probe.naturalHeight });
      probe.src = url;
      runMobileColorExtraction(url);
    }
  };

  const handleRemoveMobileImage = () => {
    setMobileImage(null);
    setMobileImageSize(null);
    setMobilePalette([]);
    setMobileSelectedPaletteIndex(0);
    setMobileBaseColor({ h: 0, s: 0, l: 0 });
    setMobileExtractedHex('#000000');
    setMobileNormalizedHex('#000000');
  };

  const runColorExtraction = (src: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maxW = 400;
      const ratio = img.width > maxW ? maxW / img.width : 1;
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const paletteResult = extractColorPalette(imageData.data, canvas.width, canvas.height);
      setPalette(paletteResult);
      setSelectedPaletteIndex(0);
      applyPaletteEntry(paletteResult[0]);
    };
    img.src = src;
  };

  const runMobileColorExtraction = (src: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maxW = 400;
      const ratio = img.width > maxW ? maxW / img.width : 1;
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const paletteResult = extractColorPalette(imageData.data, canvas.width, canvas.height);
      setMobilePalette(paletteResult);
      setMobileSelectedPaletteIndex(0);
      applyMobilePaletteEntry(paletteResult[0]);
    };
    img.src = src;
  };

  const applyPaletteEntry = (entry: PaletteEntry) => {
    const hsl = rgbToHsl(entry.normalizedRgb.r, entry.normalizedRgb.g, entry.normalizedRgb.b);
    setBaseColor(hsl);
    setExtractedHex(entry.hex);
    setNormalizedHex(entry.normalizedHex);
  };

  const applyMobilePaletteEntry = (entry: PaletteEntry) => {
    const hsl = rgbToHsl(entry.normalizedRgb.r, entry.normalizedRgb.g, entry.normalizedRgb.b);
    setMobileBaseColor(hsl);
    setMobileExtractedHex(entry.hex);
    setMobileNormalizedHex(entry.normalizedHex);
  };

  const handleSelectPaletteColor = (index: number) => {
    setSelectedPaletteIndex(index);
    if (palette[index]) {
      applyPaletteEntry(palette[index]);
    }
  };

  const handleSelectMobilePaletteColor = (index: number) => {
    setMobileSelectedPaletteIndex(index);
    if (mobilePalette[index]) {
      applyMobilePaletteEntry(mobilePalette[index]);
    }
  };

  const handleExportSingle = async (formatId: string, node: HTMLElement | null) => {
    if (!node) return;
    try {
      const format = FORMATS.find(f => f.id === formatId);
      if (!format) return;
      
      const wasShowing = showSafeAreas;
      if (wasShowing) setShowSafeAreas(false);

      setExportProgress({ phase: 'rendering', current: 0, total: 1, currentLabel: `${format.name} · ${LANGUAGES.find(l => l.code === activeLang)?.label || activeLang}` });
      
      await new Promise(res => setTimeout(res, 50));
      
      const dataUrl = await htmlToImage.toPng(node, {
        quality: 1,
        pixelRatio: 1,
        width: format.width,
        height: format.height,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });
      
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.download = `campaign_${formatId}_${activeLang}_${date}.png`;
      link.href = dataUrl;
      link.click();
      
      if (wasShowing) setShowSafeAreas(true);

      setExportProgress({ phase: 'done', current: 1, total: 1, currentLabel: '' });
      setTimeout(() => setExportProgress(null), 3000);
    } catch (err) {
      console.error('Export failed', err);
      setExportProgress(null);
    }
  };

  // Export all selected formats × all enabled languages
  const handleExportAll = async () => {
    const wasShowing = showSafeAreas;
    if (wasShowing) setShowSafeAreas(false);
    const originalLang = activeLang;
    const langsToExport = filledLangs.filter(l => enabledExportLangs.has(l));

    const totalImages = langsToExport.length * selectedFormats.length;
    let rendered = 0;

    setExportProgress({ phase: 'rendering', current: 0, total: totalImages, currentLabel: 'Preparing...' });

    const zip = new JSZip();

    for (const lang of langsToExport) {
      setActiveLang(lang);
      await new Promise(r => setTimeout(r, 150));
      const langInfo = LANGUAGES.find(l => l.code === lang);

      for (const formatId of selectedFormats) {
        const el = document.getElementById(`export-node-${formatId}`);
        if (!el) { rendered++; continue; }
        const format = FORMATS.find(f => f.id === formatId);
        if (!format) { rendered++; continue; }

        setExportProgress({
          phase: 'rendering',
          current: rendered,
          total: totalImages,
          currentLabel: `${format.name} · ${langInfo?.label || lang}`,
        });

        const dataUrl = await htmlToImage.toPng(el, {
          quality: 1,
          pixelRatio: 1,
          width: format.width,
          height: format.height,
          style: { transform: 'scale(1)', transformOrigin: 'top left' },
        });

        const date = new Date().toISOString().split('T')[0];
        const fileName = `campaign_${formatId}_${lang}_${date}.png`;
        zip.file(fileName, dataUrl.split(',')[1], { base64: true });

        rendered++;
        setExportProgress({
          phase: 'rendering',
          current: rendered,
          total: totalImages,
          currentLabel: `${format.name} · ${langInfo?.label || lang}`,
        });

        await new Promise(r => setTimeout(r, 200));
      }
    }

    setActiveLang(originalLang);
    if (wasShowing) setShowSafeAreas(true);

    setExportProgress({ phase: 'zipping', current: totalImages, total: totalImages, currentLabel: 'Creating ZIP archive...' });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    const langSuffix = langsToExport.join('_');
    link.download = `campaign_banners_${langSuffix}_${date}.zip`;
    link.href = URL.createObjectURL(content);
    link.click();
    URL.revokeObjectURL(link.href);

    setExportProgress({ phase: 'done', current: totalImages, total: totalImages, currentLabel: '' });

    // Auto-dismiss after 4 seconds
    setTimeout(() => setExportProgress(null), 4000);
  };

  const config = {
    image, title, subtitle, buttonText, showSafeAreas, 
    baseColor, extractedHex, normalizedHex, palette, selectedPaletteIndex,
  };

  const handleApplySuggestion = useCallback((field: string, suggestion: string) => {
    if (field === 'title') setTitle(suggestion);
    else if (field === 'subtitle') setSubtitle(suggestion);
    else if (field === 'button') setButtonText(suggestion);
  }, [setTitle, setSubtitle, setButtonText]);

  // Aggregate errors across all selected formats for "Export All" gating
  const allSelectedErrors = useMemo(() => {
    const errors: StatusPillData[] = [];
    const seen = new Set<string>();
    for (const fid of selectedFormats) {
      const format = FORMATS.find(f => f.id === fid);
      if (!format) continue;
      const transform = getTransform(fid);
      const formatErrors = getFormatErrors(format, title, subtitle, buttonText, image, imageSize, transform.scale, activeLang, handleApplySuggestion);
      for (const err of formatErrors) {
        const key = `${err.label}-${err.headline}`;
        if (!seen.has(key)) {
          seen.add(key);
          errors.push(err);
        } else if (err.label === 'Resolution') {
          errors.push(err);
        }
      }
    }
    return errors;
  }, [selectedFormats, title, subtitle, buttonText, image, imageSize, formatTransforms, handleApplySuggestion, activeLang]);

  const hasAnyErrors = allSelectedErrors.length > 0;

  const handleExportAllClick = () => {
    if (hasAnyErrors) {
      setShowExportAllBlocked(true);
    } else {
      handleExportAll();
    }
  };

  // Filter visible formats by device toggle + selection, ordered: active first, deprecated last
  const visibleFormats = [
    ...FORMATS.filter(f => !f.deprecated && selectedFormats.includes(f.id) && (deviceFilter === 'all' || f.device === deviceFilter)),
    ...FORMATS.filter(f => f.deprecated && selectedFormats.includes(f.id) && (deviceFilter === 'all' || f.device === deviceFilter)),
  ];

  return (
    <div className="relative h-screen bg-[#f0f0f3] text-[#1d1d1f] font-sans overflow-hidden antialiased selection:bg-[#0071e3]/20 selection:text-[#0071e3]">
      {/* ── Floating Header ───────────────────────────── */}
      <header className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between px-5 h-[52px] bg-white/70 backdrop-blur-2xl rounded-full border border-white/40 shadow-[0_1px_12px_rgba(0,0,0,0.06)]">
        {/* Left: Guidelines button */}
        <div className="w-[200px] flex items-center">
          <Link
            to="/guidelines"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-[#86868b] hover:text-[#0071e3] hover:bg-[#0071e3]/10 transition-all"
            title="Banner guidelines"
          >
            <BookOpen size={15} strokeWidth={2} />
            Guidelines
          </Link>
        </div>

        {/* Center: Device toggles */}
        <div className="flex items-center bg-black/[0.04] rounded-full p-[3px]">
          <button
            onClick={() => setDeviceFilter('all')}
            className={`flex items-center gap-1.5 px-5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer ${
              deviceFilter === 'all'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setDeviceFilter('mobile')}
            className={`flex items-center gap-1.5 px-5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer ${
              deviceFilter === 'mobile'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <Smartphone size={14} strokeWidth={2} />
          </button>
          <button
            onClick={() => setDeviceFilter('desktop')}
            className={`flex items-center gap-1.5 px-5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer ${
              deviceFilter === 'desktop'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <Monitor size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Right: Guides toggle + Export All */}
        <div className="flex items-center gap-2.5 justify-end">
          <button
            onClick={() => setShowSafeAreas(!showSafeAreas)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
              showSafeAreas
                ? 'bg-[#0071e3]/10 text-[#0071e3]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
            title="Toggle safe areas"
          >
            {showSafeAreas ? <Eye size={14} strokeWidth={2.5} /> : <EyeOff size={14} strokeWidth={2.5} />}
            Guides
          </button>
          <button 
            onClick={handleExportAllClick}
            disabled={selectedFormats.length === 0}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97] cursor-pointer ${
              hasAnyErrors
                ? 'bg-[#ff3b30] text-white hover:bg-[#e0342d]'
                : 'bg-[#1d1d1f] text-white hover:bg-[#333336]'
            }`}
          >
            {hasAnyErrors ? <ShieldAlert size={13} /> : <Download size={13} />}
            Export all
          </button>
        </div>
      </header>

      {/* ── Floating Sidebar ────────────────────────── */}
      <div className="absolute top-[76px] left-3 bottom-3 z-20">
        <Sidebar 
          formats={FORMATS}
          selectedFormats={selectedFormats}
          setSelectedFormats={setSelectedFormats}
          handleImageUpload={handleImageUpload}
          handleRemoveImage={handleRemoveImage}
          handleMobileImageUpload={handleMobileImageUpload}
          handleRemoveMobileImage={handleRemoveMobileImage}
          mobileImage={mobileImage}
          mobilePalette={mobilePalette}
          mobileSelectedPaletteIndex={mobileSelectedPaletteIndex}
          onSelectMobilePaletteColor={handleSelectMobilePaletteColor}
          config={config}
          setTitle={setTitle}
          setSubtitle={setSubtitle}
          setButtonText={setButtonText}
          onSelectPaletteColor={handleSelectPaletteColor}
          activeLang={activeLang}
          setActiveLang={setActiveLang}
          filledLangs={filledLangs}
          titles={titles}
          handleTranslateFromEnglish={handleTranslateFromEnglish}
          isTranslating={isTranslating}
          translationLimitReached={translationLimitReached}
        />
      </div>

      {/* ── Main Preview Area ─────────────────────────── */}
      <div className="absolute top-[76px] left-[404px] right-3 bottom-3 overflow-auto rounded-2xl">
        <div className="p-8 md:p-10">
          <div className="max-w-[1200px] mx-auto space-y-12 pb-20">
            {visibleFormats.length === 0 ? (
              <motion.div
                className="text-center py-32 bg-white/60 backdrop-blur-xl text-[#86868b] border border-white/40 rounded-2xl shadow-[0_1px_12px_rgba(0,0,0,0.04)]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <LayoutTemplate className="mx-auto mb-4 opacity-40 text-[#1d1d1f]" size={48} strokeWidth={1.5} />
                <p className="text-[17px] font-medium text-[#1d1d1f]">No formats visible</p>
                <p className="text-[14px] mt-1">
                  {selectedFormats.length === 0 
                    ? 'Select formats from the sidebar to begin.' 
                    : `No ${deviceFilter} formats are selected. Switch device type or enable formats in the sidebar.`
                  }
                </p>
              </motion.div>
            ) : (
              <div className="space-y-14">
                {visibleFormats.map((format, idx) => {
                  // For mobile formats, use mobileImage if available, otherwise fall back to main image
                  const isMobileFormat = format.device === 'mobile';
                  const effectiveImage = (isMobileFormat && mobileImage) ? mobileImage : image;
                  const effectiveImageSize = (isMobileFormat && mobileImage) ? mobileImageSize : imageSize;
                  const useMobileColors = isMobileFormat && mobileImage && mobilePalette.length > 0;
                  const formatConfig = {
                    ...config,
                    image: effectiveImage,
                    ...(useMobileColors ? {
                      baseColor: mobileBaseColor,
                      extractedHex: mobileExtractedHex,
                      normalizedHex: mobileNormalizedHex,
                      palette: mobilePalette,
                      selectedPaletteIndex: mobileSelectedPaletteIndex,
                    } : {}),
                  };
                  return (
                  <motion.div
                    key={format.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: idx * 0.06, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <BannerPreview 
                      format={format} 
                      config={formatConfig}
                      transform={getTransform(format.id)}
                      imageSize={effectiveImageSize}
                      onTransformChange={(patch: Partial<{ posX: number; posY: number; scale: number; flipX: boolean }>) => updateTransform(format.id, patch)}
                      onExport={(node: HTMLElement | null) => handleExportSingle(format.id, node)}
                      onApplySuggestion={handleApplySuggestion}
                      onSelectPaletteColor={isMobileFormat ? handleSelectMobilePaletteColor : handleSelectPaletteColor}
                      filledLangs={filledLangs}
                      enabledExportLangs={enabledExportLangs}
                      onToggleExportLang={toggleExportLang}
                      activeLang={activeLang}
                    />
                  </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export All blocked modal */}
      {showExportAllBlocked && (
        <ExportBlockedCard
          errors={allSelectedErrors}
          onClose={() => setShowExportAllBlocked(false)}
        />
      )}

      {/* Export progress banner */}
      <ExportProgressBanner
        progress={exportProgress}
        onDismiss={() => setExportProgress(null)}
      />
    </div>
  );
}