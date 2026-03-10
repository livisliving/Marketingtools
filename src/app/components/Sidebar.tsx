import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Type, Sliders, LayoutTemplate, Check, ChevronDown, RefreshCw, Trash2, AlertTriangle, Clock, Info, AlertCircle, Smartphone, X } from 'lucide-react';
import svgPaths from '../../imports/svg-cofj40jkx7';
import { BannerDetails } from './BannerDetails';
import { Link } from 'react-router';
import { LANGUAGES } from './Generator';
import type { LangCode } from './Generator';

export function Sidebar({ 
  formats, 
  selectedFormats, 
  setSelectedFormats,
  handleImageUpload,
  handleRemoveImage,
  handleMobileImageUpload,
  handleRemoveMobileImage,
  mobileImage,
  mobilePalette,
  mobileSelectedPaletteIndex,
  onSelectMobilePaletteColor,
  config,
  setTitle,
  setSubtitle,
  setButtonText,
  onSelectPaletteColor,
  activeLang,
  setActiveLang,
  filledLangs,
  titles,
  handleTranslateFromEnglish,
  isTranslating,
  translationLimitReached,
}: any) {
  
  const [formatsExpanded, setFormatsExpanded] = useState(false);
  
  const toggleFormat = (id: string) => {
    setSelectedFormats((prev: string[]) => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const getMinMaxChars = (type: 'title' | 'subtitle') => {
    if (selectedFormats.length === 0) return 100;
    const maxes = selectedFormats.map((id: string) => {
      const f = formats.find((f: any) => f.id === id);
      return f ? (type === 'title' ? f.titleChars : f.subtitleChars) : 100;
    });
    return Math.min(...maxes);
  };

  const maxTitleChars = getMinMaxChars('title');
  const maxSubtitleChars = getMinMaxChars('subtitle');

  // Detect block caps words (2+ consecutive uppercase letters)
  const hasBlockCaps = (text: string): boolean => {
    return /\b[A-Z]{2,}\b/.test(text);
  };

  // Fix block caps by converting to sentence case
  const fixBlockCaps = (text: string): string => {
    if (!text) return text;
    const lower = text.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  // Compute minimum recommended resolution based on selected formats
  const minRecommendedRes = (() => {
    if (selectedFormats.length === 0) return null;
    let maxW = 0, maxH = 0;
    for (const id of selectedFormats) {
      const f = formats.find((f: any) => f.id === id);
      if (f) {
        if (f.width > maxW) maxW = f.width;
        if (f.height > maxH) maxH = f.height;
      }
    }
    return { w: maxW, h: maxH };
  })();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  const activeFormats = formats.filter((f: any) => !f.deprecated);
  const deprecatedFormats = formats.filter((f: any) => f.deprecated);

  return (
    <aside className="w-[380px] h-full bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/40 shadow-[0_1px_12px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden">
      <div className="py-3.5 border-b border-black/[0.04] sticky top-0 bg-white/70 backdrop-blur-2xl z-20 rounded-t-3xl flex justify-between items-center px-[24px] py-[20px]">
        <svg className="h-[22px] w-auto flex-shrink-0" fill="none" viewBox="0 0 109.775 30.0001">
          <path d={svgPaths.p29e27900} fill="#E1251B" />
        </svg>
        <p className="text-[13px] text-[#86868b] font-medium">Marketing Tools</p>
      </div>
      
      <div className="py-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
        {/* Format Selector — collapsible */}
        <section className="px-5">
          <button
            onClick={() => setFormatsExpanded(!formatsExpanded)}
            className="flex items-center justify-between w-full mb-3 ml-1 pr-1 group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-[#86868b]">
              <LayoutTemplate size={14} strokeWidth={2.5} />
              <h3 className="text-[12px] font-bold uppercase tracking-wider">Formats</h3>
              <motion.span
                className="text-[11px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-1.5 py-0.5 rounded-md tabular-nums"
                key={selectedFormats.length}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 400 }}
              >
                {selectedFormats.length}/{formats.length}
              </motion.span>
            </div>
            <motion.div
              animate={{ rotate: formatsExpanded ? 180 : 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <ChevronDown
                size={14}
                strokeWidth={2.5}
                className="text-[#86868b] group-hover:text-[#1d1d1f] transition-colors"
              />
            </motion.div>
          </button>
          <motion.div
            className="overflow-hidden"
            initial={false}
            animate={{
              height: formatsExpanded ? 'auto' : 0,
              opacity: formatsExpanded ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Active Formats */}
            <div className="bg-white rounded-[14px] shadow-sm border border-black/[0.04] overflow-hidden">
              {activeFormats.map((format: any, idx: number) => (
                <label 
                  key={format.id} 
                  className={`flex items-center gap-3.5 p-3.5 cursor-pointer hover:bg-[#f5f5f7]/50 active:bg-[#f5f5f7] transition-colors ${idx !== activeFormats.length - 1 ? 'border-b border-black/[0.04]' : ''}`}
                >
                  <div className="relative flex items-center justify-center flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={selectedFormats.includes(format.id)}
                      onChange={() => toggleFormat(format.id)}
                      className="peer appearance-none w-[22px] h-[22px] border border-[#d2d2d7] rounded-full checked:bg-[#0071e3] checked:border-transparent transition-all cursor-pointer"
                    />
                    <AnimatePresence>
                      {selectedFormats.includes(format.id) && (
                        <motion.div
                          className="absolute pointer-events-none"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', damping: 15, stiffness: 500 }}
                        >
                          <Check size={14} className="text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[15px] font-medium text-[#1d1d1f] leading-tight">{format.name}</span>
                    <div className="mt-0.5">
                      <BannerDetails device={format.device} placement={format.placement} width={format.width} height={format.height} />
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Deprecated Formats */}
            {deprecatedFormats.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1.5 mb-2 ml-1">
                  <Clock size={11} className="text-[#ff9500]" strokeWidth={2.5} />
                  <span className="text-[11px] font-semibold text-[#ff9500] uppercase tracking-wider">Deprecated — use until 15 Mar 2026</span>
                </div>
                <div className="bg-[#ff9500]/[0.04] rounded-[14px] shadow-sm border border-[#ff9500]/15 overflow-hidden">
                  {deprecatedFormats.map((format: any, idx: number) => (
                    <label 
                      key={format.id} 
                      className={`flex items-center gap-3.5 p-3.5 cursor-pointer hover:bg-[#ff9500]/[0.06] active:bg-[#ff9500]/[0.08] transition-colors ${idx !== deprecatedFormats.length - 1 ? 'border-b border-[#ff9500]/10' : ''}`}
                    >
                      <div className="relative flex items-center justify-center flex-shrink-0">
                        <input 
                          type="checkbox" 
                          checked={selectedFormats.includes(format.id)}
                          onChange={() => toggleFormat(format.id)}
                          className="peer appearance-none w-[22px] h-[22px] border border-[#ff9500]/30 rounded-full checked:bg-[#ff9500] checked:border-transparent transition-all cursor-pointer"
                        />
                        <AnimatePresence>
                          {selectedFormats.includes(format.id) && (
                            <motion.div
                              className="absolute pointer-events-none"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: 'spring', damping: 15, stiffness: 500 }}
                            >
                              <Check size={14} className="text-white" strokeWidth={3} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium text-[#1d1d1f] leading-tight">{format.name}</span>
                          <span className="text-[9px] font-bold text-[#ff9500] bg-[#ff9500]/10 px-1.5 py-[1px] rounded uppercase tracking-wide flex-shrink-0">Sunset</span>
                        </div>
                        <div className="mt-0.5">
                          <BannerDetails device={format.device} placement={format.placement} width={format.width} height={format.height} />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </section>

        {/* Image Upload & Adjustments */}
        <section className="px-5">
          <div className="flex items-center gap-2 text-[#86868b] mb-3 ml-1">
            <ImageIcon size={14} strokeWidth={2.5} />
            <h3 className="text-[12px] font-bold uppercase tracking-wider">Background</h3>
          </div>
          
          <div className="bg-white rounded-[14px] shadow-sm border border-black/[0.04] p-4 space-y-5">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            <AnimatePresence mode="wait">
              {config.image ? (
                <motion.div
                  key="image-preview"
                  className="relative w-full h-28 rounded-[10px] overflow-hidden"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <img src={config.image} alt="Background preview" className="w-full h-full object-cover" />
                  <motion.div
                    className="absolute top-2 right-2 flex gap-1.5"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.2 }}
                  >
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                      title="Change image"
                    >
                      <RefreshCw size={13} strokeWidth={2} className="text-[#1d1d1f]" />
                    </button>
                    <button
                      onClick={handleRemoveImage}
                      className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 size={13} strokeWidth={2} className="text-[#ff3b30]" />
                    </button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.label
                  key="image-upload"
                  className="flex flex-col items-center justify-center w-full h-28 px-4 transition-all border border-[#d2d2d7] border-dashed rounded-[10px] cursor-pointer hover:border-[#86868b] hover:bg-[#f5f5f7]/50 bg-[#f5f5f7]/30 group"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <ImageIcon className="w-7 h-7 text-[#86868b] mb-2 group-hover:text-[#1d1d1f] transition-colors" strokeWidth={1.5} />
                  <span className="font-medium text-[#1d1d1f] text-[14px]">Upload image</span>
                  {minRecommendedRes && (
                    <span className="text-[11px] text-[#86868b] mt-0.5">
                      Min. recommended: {minRecommendedRes.w} × {minRecommendedRes.h}px
                    </span>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </motion.label>
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {config.image && (
                <motion.div
                  className="space-y-4 pt-1"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  {/* Color Palette Buckets */}
                  {config.palette && config.palette.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[13px] font-medium">
                        <span className="text-[#1d1d1f]">Dominant Colors</span>
                        <div className="flex items-center gap-2">
                          <Link
                            to="/guidelines#tintsync"
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0071e3]/10 hover:bg-[#0071e3]/20 transition-colors"
                            title="How TintSync works"
                          >
                            <Info size={11} strokeWidth={2.5} className="text-[#0071e3]" />
                          </Link>
                          <span className="text-[#86868b]">{config.palette.length} clusters</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {config.palette.map((entry: any, idx: number) => {
                          const isSelected = idx === config.selectedPaletteIndex;
                          const pct = Math.round(entry.weight * 100);
                          return (
                            <motion.button
                              key={idx}
                              onClick={() => onSelectPaletteColor(idx)}
                              title={`${entry.hex} (${pct}%)${entry.isNearBW ? ' — near B/W' : ''}`}
                              className={`relative flex flex-col items-center gap-1 rounded-[10px] pt-1.5 pb-1 transition-all ${
                                isSelected 
                                  ? 'bg-[#0071e3]/10 ring-2 ring-[#0071e3] ring-offset-1' 
                                  : 'bg-[#f5f5f7] hover:bg-[#ebebeb]'
                              } ${entry.isNearBW ? 'opacity-50' : ''}`}
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: entry.isNearBW ? 0.5 : 1, scale: 1 }}
                              transition={{ 
                                duration: 0.3, 
                                delay: idx * 0.04,
                                type: 'spring',
                                damping: 18,
                                stiffness: 350,
                              }}
                              whileTap={{ scale: 0.92 }}
                            >
                              <motion.div 
                                className="w-7 h-7 rounded-full border border-black/10 shadow-sm flex-shrink-0"
                                style={{ backgroundColor: entry.normalizedHex || entry.hex }}
                                animate={isSelected ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                                transition={{ duration: 0.3 }}
                              />
                              <span className={`text-[9px] font-medium tabular-nums ${isSelected ? 'text-[#0071e3]' : 'text-[#86868b]'}`}>
                                {pct}%
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-[#86868b]">Select a cluster for the gradient overlay</p>
                      {/* Low-dominance warning */}
                      <AnimatePresence>
                        {config.palette[config.selectedPaletteIndex] && Math.round(config.palette[config.selectedPaletteIndex].weight * 100) < 10 && (
                          <motion.div
                            className="flex items-start gap-2 bg-[#ff9f0a]/10 border border-[#ff9f0a]/25 rounded-[10px] px-3 py-2.5"
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                          >
                            <svg className="w-4 h-4 text-[#ff9f0a] flex-shrink-0 mt-[1px]" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.75.75 0 0 1 .65.38l6.25 10.75A.75.75 0 0 1 14.25 13H1.75a.75.75 0 0 1-.65-1.13L7.35 1.38A.75.75 0 0 1 8 1ZM7.25 9.5V6h1.5v3.5h-1.5Zm.75 2.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"/></svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-[#cc7700]">Low dominance ({Math.round(config.palette[config.selectedPaletteIndex].weight * 100)}%)</p>
                              <p className="text-[10px] text-[#cc7700]/80 mt-0.5">Selected color represents less than 10% of the image. The gradient may not blend naturally.</p>
                            </div>
                            <button
                              onClick={() => onSelectPaletteColor(0)}
                              className="flex-shrink-0 text-[11px] font-semibold text-[#ff9f0a] hover:text-[#e08600] bg-[#ff9f0a]/10 hover:bg-[#ff9f0a]/20 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                            >
                              Fix
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Image Override — only visible when main image is set */}
            <AnimatePresence>
              {config.image && (
                <motion.div
                  className="mt-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <input type="file" ref={mobileFileInputRef} className="hidden" accept="image/*" onChange={handleMobileImageUpload} />
                  <AnimatePresence mode="wait">
                    {mobileImage ? (
                      <motion.div
                        key="mobile-preview"
                        className="bg-white rounded-[14px] shadow-sm border border-black/[0.04] p-3"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      >
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0071e3]/10">
                            <Smartphone size={11} strokeWidth={2.5} className="text-[#0071e3]" />
                          </div>
                          <span className="text-[12px] font-semibold text-[#1d1d1f]">Mobile override</span>
                          <span className="text-[10px] text-[#86868b] font-medium ml-auto">Active</span>
                        </div>
                        <div className="relative w-full h-16 rounded-[8px] overflow-hidden">
                          <img src={mobileImage} alt="Mobile background" className="w-full h-full object-cover" />
                          <div className="absolute top-1.5 right-1.5 flex gap-1">
                            <button
                              onClick={() => mobileFileInputRef.current?.click()}
                              className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                              title="Change mobile image"
                            >
                              <RefreshCw size={11} strokeWidth={2} className="text-[#1d1d1f]" />
                            </button>
                            <button
                              onClick={handleRemoveMobileImage}
                              className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer"
                              title="Remove mobile image"
                            >
                              <X size={11} strokeWidth={2.5} className="text-[#ff3b30]" />
                            </button>
                          </div>
                        </div>
                        {/* Mobile Palette */}
                        {mobilePalette && mobilePalette.length > 0 && (
                          <div className="mt-3 space-y-2.5">
                            <div className="flex justify-between text-[13px] font-medium">
                              <span className="text-[#1d1d1f]">Mobile Colors</span>
                              <span className="text-[#86868b]">{mobilePalette.length} clusters</span>
                            </div>
                            <div className="grid grid-cols-6 gap-1.5">
                              {mobilePalette.map((entry: any, idx: number) => {
                                const isSelected = idx === mobileSelectedPaletteIndex;
                                const pct = Math.round(entry.weight * 100);
                                return (
                                  <motion.button
                                    key={idx}
                                    onClick={() => onSelectMobilePaletteColor(idx)}
                                    title={`${entry.hex} (${pct}%)${entry.isNearBW ? ' — near B/W' : ''}`}
                                    className={`relative flex flex-col items-center gap-1 rounded-[10px] pt-1.5 pb-1 transition-all ${
                                      isSelected 
                                        ? 'bg-[#0071e3]/10 ring-2 ring-[#0071e3] ring-offset-1' 
                                        : 'bg-[#f5f5f7] hover:bg-[#ebebeb]'
                                    } ${entry.isNearBW ? 'opacity-50' : ''}`}
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: entry.isNearBW ? 0.5 : 1, scale: 1 }}
                                    transition={{ 
                                      duration: 0.3, 
                                      delay: idx * 0.04,
                                      type: 'spring',
                                      damping: 18,
                                      stiffness: 350,
                                    }}
                                    whileTap={{ scale: 0.92 }}
                                  >
                                    <motion.div 
                                      className="w-7 h-7 rounded-full border border-black/10 shadow-sm flex-shrink-0"
                                      style={{ backgroundColor: entry.normalizedHex || entry.hex }}
                                      animate={isSelected ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                                      transition={{ duration: 0.3 }}
                                    />
                                    <span className={`text-[9px] font-medium tabular-nums ${isSelected ? 'text-[#0071e3]' : 'text-[#86868b]'}`}>
                                      {pct}%
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                            <p className="text-[11px] text-[#86868b]">Select a cluster for mobile gradient overlay</p>
                            {/* Low-dominance warning */}
                            <AnimatePresence>
                              {mobilePalette[mobileSelectedPaletteIndex] && Math.round(mobilePalette[mobileSelectedPaletteIndex].weight * 100) < 10 && (
                                <motion.div
                                  className="flex items-start gap-2 bg-[#ff9f0a]/10 border border-[#ff9f0a]/25 rounded-[10px] px-3 py-2.5"
                                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                  animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                >
                                  <svg className="w-4 h-4 text-[#ff9f0a] flex-shrink-0 mt-[1px]" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.75.75 0 0 1 .65.38l6.25 10.75A.75.75 0 0 1 14.25 13H1.75a.75.75 0 0 1-.65-1.13L7.35 1.38A.75.75 0 0 1 8 1ZM7.25 9.5V6h1.5v3.5h-1.5Zm.75 2.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"/></svg>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-[#cc7700]">Low dominance ({Math.round(mobilePalette[mobileSelectedPaletteIndex].weight * 100)}%)</p>
                                    <p className="text-[10px] text-[#cc7700]/80 mt-0.5">Selected color represents less than 10% of the image. The gradient may not blend naturally.</p>
                                  </div>
                                  <button
                                    onClick={() => onSelectMobilePaletteColor(0)}
                                    className="flex-shrink-0 text-[11px] font-semibold text-[#ff9f0a] hover:text-[#e08600] bg-[#ff9f0a]/10 hover:bg-[#ff9f0a]/20 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                                  >
                                    Fix
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                        <p className="text-[10px] text-[#86868b] mt-2">Mobile banners use this image and its own gradient colors.</p>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="mobile-add"
                        onClick={() => mobileFileInputRef.current?.click()}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] border border-dashed border-black/[0.08] hover:border-[#0071e3]/30 hover:bg-[#0071e3]/[0.02] transition-all group cursor-pointer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-[8px] bg-[#f5f5f7] group-hover:bg-[#0071e3]/10 transition-colors">
                          <Smartphone size={14} strokeWidth={2} className="text-[#86868b] group-hover:text-[#0071e3] transition-colors" />
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className="text-[13px] font-medium text-[#1d1d1f]">Add mobile image</span>
                          <span className="text-[11px] text-[#86868b]">Use a different image for mobile banners</span>
                        </div>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Text Input */}
        <section className="px-5">
          <div className="flex items-center gap-2 text-[#86868b] mb-3 ml-1">
            <Type size={14} strokeWidth={2.5} />
            <h3 className="text-[12px] font-bold uppercase tracking-wider">Content</h3>
          </div>
          
          {/* Language Tab Bar */}
          <div className="flex items-center gap-1 mb-3 bg-[#f5f5f7] rounded-[10px] p-1">
            {LANGUAGES.map((lang) => {
              const isActive = activeLang === lang.code;
              const hasFill = filledLangs?.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  onClick={() => setActiveLang(lang.code)}
                  title={lang.name}
                  className={`relative flex items-center justify-center flex-1 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {lang.label}
                  {hasFill && (
                    <span className={`absolute top-1 right-1.5 w-[5px] h-[5px] rounded-full ${isActive ? 'bg-[#34c759]/80' : 'bg-[#34c759]'}`} />
                  )}
                  {!hasFill && lang.code !== 'en' && (
                    <span className={`absolute top-1 right-1.5 w-[5px] h-[5px] rounded-full ${isActive ? 'bg-[#d2d2d7]/60' : 'bg-[#d2d2d7]'}`} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-[14px] shadow-sm border border-black/[0.04] p-4 space-y-4">
            {/* English reference + Translate button for non-EN languages */}
            <AnimatePresence>
              {activeLang !== 'en' && titles?.en && (
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <div className="text-[11px] text-[#86868b] bg-[#f5f5f7] rounded-[8px] px-3 py-2">
                    <span className="font-medium text-[#1d1d1f]">EN:</span> {titles.en}
                  </div>
                  {translationLimitReached ? (
                    <motion.div
                      className="bg-[#f5f5f7] border border-black/[0.04] rounded-[10px] px-3 py-2.5 space-y-1.5"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle size={13} className="text-[#86868b] flex-shrink-0 mt-[1px]" strokeWidth={2.5} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-[#86868b]">Daily translation limit reached</p>
                          <p className="text-[10px] text-[#86868b]/70 mt-0.5">
                            The free API allows ~5,000 characters per day. Resets tomorrow — you can still type translations manually.
                          </p>
                        </div>
                      </div>
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-[8px] text-[12px] font-semibold bg-black/[0.03] text-[#b0b0b5] cursor-not-allowed"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                          <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
                        </svg>
                        Translate from English
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <motion.button
                        onClick={handleTranslateFromEnglish}
                        disabled={isTranslating || !titles?.en?.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-[8px] text-[12px] font-semibold bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/15 active:bg-[#0071e3]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        whileTap={{ scale: 0.98 }}
                      >
                        {isTranslating ? (
                          <>
                            <motion.div
                              className="w-3.5 h-3.5 border-2 border-[#0071e3]/30 border-t-[#0071e3] rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            />
                            Translating...
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
                            </svg>
                            Translate from English
                          </>
                        )}
                      </motion.button>
                      <p className="text-[10px] text-[#86868b] text-center">Fields will be populated — edit any translation afterwards</p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[13px] font-medium mb-1">
                <label className="text-[#1d1d1f]">Title <span className="text-[#86868b] font-normal text-[11px]">(Barlow Bold)</span></label>
                <motion.span
                  className={`text-[#86868b] ${config.title.length > maxTitleChars ? 'text-red-500' : ''}`}
                  key={config.title.length > maxTitleChars ? 'over' : 'ok'}
                  animate={config.title.length > maxTitleChars ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {config.title.length}/{maxTitleChars}
                </motion.span>
              </div>
              <input 
                type="text" 
                value={config.title} 
                onChange={(e) => {
                  if (e.target.value.length <= maxTitleChars) setTitle(e.target.value);
                }} 
                className="w-full bg-[#f5f5f7] border border-transparent rounded-[10px] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all placeholder:text-[#86868b]"
                placeholder="Super Deals Today"
              />
              <AnimatePresence>
                {hasBlockCaps(config.title) && (
                  <motion.div
                    className="flex items-center gap-1.5 mt-1"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <AlertTriangle size={13} className="text-[#ff9500] flex-shrink-0" />
                    <span className="text-[11px] text-[#ff9500] font-medium">Avoid block caps (e.g. BIG DEALS) — use sentence case instead</span>
                    <button
                      onClick={() => setTitle(fixBlockCaps(config.title))}
                      className="text-[11px] font-semibold text-[#cc7700] bg-[#ff9500]/10 hover:bg-[#ff9500]/20 px-2 py-0.5 rounded-md transition-colors flex-shrink-0 cursor-pointer"
                    >
                      Fix
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[13px] font-medium mb-1">
                <label className="text-[#1d1d1f]">Subtitle</label>
                <motion.span
                  className={`text-[#86868b] ${config.subtitle.length > maxSubtitleChars ? 'text-red-500' : ''}`}
                  key={config.subtitle.length > maxSubtitleChars ? 'over' : 'ok'}
                  animate={config.subtitle.length > maxSubtitleChars ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {config.subtitle.length}/{maxSubtitleChars}
                </motion.span>
              </div>
              <textarea 
                rows={2}
                value={config.subtitle} 
                onChange={(e) => {
                  if (e.target.value.length <= maxSubtitleChars) setSubtitle(e.target.value);
                }} 
                className="w-full bg-[#f5f5f7] border border-transparent rounded-[10px] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all placeholder:text-[#86868b] resize-none"
                placeholder="Up to 50% off"
              />
              <AnimatePresence>
                {hasBlockCaps(config.subtitle) && (
                  <motion.div
                    className="flex items-center gap-1.5 mt-1"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <AlertTriangle size={13} className="text-[#ff9500] flex-shrink-0" />
                    <span className="text-[11px] text-[#ff9500] font-medium">Avoid block caps (e.g. BIG DEALS) — use sentence case instead</span>
                    <button
                      onClick={() => setSubtitle(fixBlockCaps(config.subtitle))}
                      className="text-[11px] font-semibold text-[#cc7700] bg-[#ff9500]/10 hover:bg-[#ff9500]/20 px-2 py-0.5 rounded-md transition-colors flex-shrink-0 cursor-pointer"
                    >
                      Fix
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[13px] font-medium mb-1">
                <label className="text-[#1d1d1f]">Button Text</label>
                <span className={`text-[#86868b] ${config.buttonText.length > 20 ? 'text-red-500' : ''}`}>
                  {config.buttonText.length}/20
                </span>
              </div>
              <input 
                type="text" 
                value={config.buttonText} 
                onChange={(e) => {
                  if (e.target.value.length <= 20) setButtonText(e.target.value);
                }} 
                className="w-full bg-[#f5f5f7] border border-transparent rounded-[10px] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all placeholder:text-[#86868b]"
                placeholder="Shop now"
              />
              <AnimatePresence>
                {hasBlockCaps(config.buttonText) && (
                  <motion.div
                    className="flex items-center gap-1.5 mt-1"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <AlertTriangle size={13} className="text-[#ff9500] flex-shrink-0" />
                    <span className="text-[11px] text-[#ff9500] font-medium">Avoid block caps (e.g. BIG DEALS) — use sentence case instead</span>
                    <button
                      onClick={() => setButtonText(fixBlockCaps(config.buttonText))}
                      className="text-[11px] font-semibold text-[#cc7700] bg-[#ff9500]/10 hover:bg-[#ff9500]/20 px-2 py-0.5 rounded-md transition-colors flex-shrink-0 cursor-pointer"
                    >
                      Fix
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}