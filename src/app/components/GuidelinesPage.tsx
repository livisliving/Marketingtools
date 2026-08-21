import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router';
import {
  ArrowLeft,
  Type,
  Image,
  Move,
  ZoomIn,
  Layers,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Smartphone,
  Monitor,
  Hash,
  CaseSensitive,
  Space,
  Maximize2,
  Blend,
  Palette,
  Download,
  ChevronDown,
  Scan,
  Pipette,
  Sun,
  Contrast,
  ArrowRight,
  SmilePlus,
  Link2,
  CornerDownLeft,
  ALargeSmall,
  Repeat,
  CircleDot,
  Globe,
  Braces,
  MousePointerClick,
} from 'lucide-react';
import { FORMATS } from '../formats';
import {
  getTextErrors,
  getTextWarnings,
  getChineseRules,
  getUniversalRules,
  LANGUAGE_CAP_GUIDES,
  KNOWN_ACRONYMS,
} from '../utils/rule-registry';
import type { LucideIcon } from 'lucide-react';

/* ─── Icon resolver ─────────────────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  CaseSensitive, Hash, SmilePlus, Link2, Braces, ALargeSmall,
  Type, CircleDot, Repeat, Space, CornerDownLeft, Globe,
};

function resolveIcon(name: string, size = 15): React.ReactNode {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon size={size} /> : null;
}

/* ─── Section definitions for navigation ────────────── */

const NAV_SECTIONS = [
  { id: 'formats', label: 'Formats', icon: <Layers size={12} strokeWidth={2.5} /> },
  { id: 'image', label: 'Image & coverage', icon: <Image size={12} strokeWidth={2.5} /> },
  { id: 'gradient', label: 'Gradient', icon: <Blend size={12} strokeWidth={2.5} /> },
  { id: 'text', label: 'Text & copy', icon: <Type size={12} strokeWidth={2.5} /> },
  { id: 'capitalisation', label: 'Capitalisation', icon: <CaseSensitive size={12} strokeWidth={2.5} /> },
  { id: 'export', label: 'Export', icon: <Download size={12} strokeWidth={2.5} /> },
  { id: 'tintsync', label: 'TintSync', icon: <Palette size={12} strokeWidth={2.5} /> },
] as const;

/* ─── Reusable atoms ────────────────────────────────── */

function Badge({ color, children }: { color: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    green: 'bg-[#34c759]/10 text-[#248a3d] border-[#34c759]/20',
    yellow: 'bg-[#ff9f0a]/10 text-[#c27800] border-[#ff9f0a]/20',
    red: 'bg-[#ff3b30]/10 text-[#d70015] border-[#ff3b30]/20',
    blue: 'bg-[#0071e3]/10 text-[#0071e3] border-[#0071e3]/20',
    gray: 'bg-black/5 text-[#6e6e73] border-black/8',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[color]}`}>
      {children}
    </span>
  );
}

function RuleRow({ icon, title, description, severity }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
}) {
  const severityConfig = {
    error: { color: 'text-[#ff3b30]', bg: 'bg-[#ff3b30]/5', border: 'border-[#ff3b30]/10', badge: 'red' as const, label: 'Blocks export' },
    warning: { color: 'text-[#ff9f0a]', bg: 'bg-[#ff9f0a]/5', border: 'border-[#ff9f0a]/10', badge: 'yellow' as const, label: 'Warning' },
    info: { color: 'text-[#0071e3]', bg: 'bg-[#0071e3]/5', border: 'border-[#0071e3]/10', badge: 'blue' as const, label: 'Info' },
  };
  const s = severityConfig[severity];
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl ${s.bg} border ${s.border}`}>
      <div className={`mt-0.5 ${s.color} shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-[#1d1d1f]">{title}</span>
          <Badge color={s.badge}>{s.label}</Badge>
        </div>
        <p className="text-[12px] text-[#6e6e73] mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function SectionCard({ id, icon, title, children }: { id?: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-28 bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-[0_1px_12px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-black/[0.04]">
        <div className="text-[#0071e3]">{icon}</div>
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">{title}</h2>
      </div>
      <div className="p-5 space-y-2.5">
        {children}
      </div>
    </div>
  );
}

/* ─── Scrollspy hook ─────────────────────────────────── */

function useScrollspy(ids: string[]) {
  const [activeId, setActiveId] = useState(ids[0]);
  const manualOverrideRef = useRef<string | null>(null);
  const overrideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const setManualActive = useCallback((id: string) => {
    // Immediately highlight on click, suppress scroll updates briefly
    setActiveId(id);
    manualOverrideRef.current = id;
    clearTimeout(overrideTimerRef.current);
    overrideTimerRef.current = setTimeout(() => {
      manualOverrideRef.current = null;
    }, 1000);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (manualOverrideRef.current) return;

      const scrollY = window.scrollY;
      const offset = 140; // header + nav height buffer
      let current = ids[0];

      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top + scrollY - offset;
          if (scrollY >= top) {
            current = id;
          }
        }
      }
      setActiveId(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [ids]);

  return { activeId, setManualActive };
}

/* ─── Main page ──────────────────────────────────────── */

export function GuidelinesPage() {
  const activeFormats = FORMATS.filter(f => !f.deprecated);
  const deprecatedFormats = FORMATS.filter(f => f.deprecated);
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

  const sectionIds = NAV_SECTIONS.map(s => s.id);
  const { activeId: activeSection, setManualActive } = useScrollspy(sectionIds);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location.hash]);

  const scrollTo = useCallback((id: string) => {
    setManualActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, [setManualActive]);

  // Scroll active nav pill into view
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector(`[data-nav="${activeSection}"]`) as HTMLElement | null;
    if (activeBtn) {
      const container = navRef.current;
      const btnLeft = activeBtn.offsetLeft;
      const btnWidth = activeBtn.offsetWidth;
      const containerWidth = container.offsetWidth;
      const targetScroll = btnLeft - containerWidth / 2 + btnWidth / 2;
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, [activeSection]);

  return (
    <div className="min-h-screen bg-[#f0f0f3] text-[#1d1d1f] font-sans antialiased selection:bg-[#0071e3]/20 selection:text-[#0071e3]">
      {/* Header with integrated nav */}
      <header className="sticky top-3 mx-3 z-30 flex items-center px-3 h-[52px] bg-white/70 backdrop-blur-2xl rounded-full border border-white/40 shadow-[0_1px_12px_rgba(0,0,0,0.06)]">
        <Link
          to="/"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-[#0071e3] hover:bg-[#0071e3]/10 transition-all shrink-0"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Back
        </Link>

        {/* Center nav */}
        <div className="flex-1 flex justify-center overflow-hidden mx-2">
          <div
            ref={navRef}
            className="flex items-center gap-0.5 overflow-x-auto no-scrollbar"
          >
            {NAV_SECTIONS.map((s) => {
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  data-nav={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-[#0071e3] text-white shadow-sm'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
                  }`}
                >
                  <span className={isActive ? 'text-white/80' : 'text-[#86868b]'}>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-[60px] shrink-0" />
      </header>

      {/* Content */}
      <div className="max-w-[720px] mx-auto px-5 pt-8 pb-20 space-y-8">
        {/* Intro */}
        <div>
          <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight">Banner guidelines</h1>
          <p className="text-[14px] text-[#6e6e73] mt-1 leading-relaxed max-w-[560px]">
            Everything you need to know about creating compliant banners — from image requirements to text rules and export. 
            Items marked <Badge color="red">Blocks export</Badge> must be resolved before exporting.
          </p>
        </div>

        {/* Status pill legend */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]">
            <XCircle size={14} className="text-[#ff3b30]" />
            <span>Error — blocks export</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]">
            <AlertTriangle size={14} className="text-[#ff9f0a]" />
            <span>Warning — exportable with caution</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]">
            <CheckCircle2 size={14} className="text-[#34c759]" />
            <span>All rules met</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            1. FORMATS & LAYOUT
            ═══════════════════════════════════════════════ */}
        <SectionCard id="formats" icon={<Layers size={16} strokeWidth={2} />} title="Formats & layout">
          <p className="text-[12px] text-[#6e6e73] leading-relaxed -mt-0.5 mb-1">
            The tool supports multiple banner formats across desktop and mobile. Each format has its own dimensions, character limits, and layout rules.
          </p>

          {/* Mobile vs desktop */}
          <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-4">
            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2.5">Desktop vs. mobile layout</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Monitor size={13} className="text-[#6e6e73] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                  <span className="font-semibold text-[#1d1d1f]">Desktop</span> — Left-aligned gradient with text overlay. CTA button rendered. Title and subtitle constrained to 60% of banner width.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Smartphone size={13} className="text-[#6e6e73] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                  <span className="font-semibold text-[#1d1d1f]">Mobile</span> — Bottom-aligned gradient with centred text. No CTA button. Subtitle constrained to a single line. Supports optional separate image with independent colour extraction.
                </p>
              </div>
            </div>
          </div>

          <RuleRow
            icon={<MousePointerClick size={15} />}
            title="No button on mobile"
            description="Mobile banners do not render a CTA button. The button text input in the sidebar only applies to desktop formats. Button validation is also skipped for mobile formats."
            severity="info"
          />
          <RuleRow
            icon={<Image size={15} />}
            title="Mobile image override"
            description="You can upload a separate image for mobile formats. When set, mobile banners use this image with its own independent per-format transforms (position, zoom, flip) and its own TintSync colour palette — desktop banners remain unaffected."
            severity="info"
          />

          {/* Format specs table */}
          <div className="mt-1 -mx-5 -mb-2.5">
            <div className="border-t border-black/[0.04]">
              <div className="px-5 py-3">
                <p className="text-[13px] font-semibold text-[#1d1d1f] mb-0.5">Format specifications</p>
                <p className="text-[11px] text-[#86868b]">Dimensions and character limits per format</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-black/[0.04] text-left text-[#86868b]">
                      <th className="px-5 py-2.5 font-semibold">Format</th>
                      <th className="px-3 py-2.5 font-semibold">Device</th>
                      <th className="px-3 py-2.5 font-semibold">Dimensions</th>
                      <th className="px-3 py-2.5 font-semibold text-center">Title max</th>
                      <th className="px-3 py-2.5 font-semibold text-center">Subtitle max</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...activeFormats, ...deprecatedFormats].map((f) => (
                      <tr key={f.id} className="border-b border-black/[0.03] last:border-0 hover:bg-black/[0.02] transition-colors">
                        <td className="px-5 py-2.5 font-medium text-[#1d1d1f]">
                          {f.name}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge color="gray">
                            {f.device === 'mobile' ? <Smartphone size={10} /> : <Monitor size={10} />}
                            {f.device}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-[#6e6e73] font-mono">{f.width}×{f.height}</td>
                        <td className="px-3 py-2.5 text-center text-[#6e6e73]">{f.titleChars}</td>
                        <td className="px-3 py-2.5 text-center text-[#6e6e73]">{f.subtitleChars}</td>
                        <td className="px-3 py-2.5">
                          {f.deprecated ? (
                            <Badge color="yellow">Sunset {(f as any).deprecationDate}</Badge>
                          ) : (
                            <Badge color="green">Active</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ═══════════════════════════════════════════════
            2. IMAGE & COVERAGE
            ═══════════════════════════════════════════════ */}
        <SectionCard id="image" icon={<Image size={16} strokeWidth={2} />} title="Image & coverage">
          <RuleRow
            icon={<Maximize2 size={15} />}
            title="Minimum resolution"
            description="The uploaded image must provide at least 50% coverage of the banner dimensions at the current zoom level. Below 50%, export is blocked with a resolution error."
            severity="error"
          />
          <RuleRow
            icon={<Move size={15} />}
            title="Edge coverage"
            description="The image must cover all required edges of the frame. Gaps where the background colour bleeds through trigger a yellow Coverage warning pill. Use the Fix button to auto-adjust."
            severity="warning"
          />
          <div className="mt-1 pl-8">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Monitor size={13} className="text-[#6e6e73] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                  <span className="font-semibold text-[#1d1d1f]">Desktop formats</span> — The left edge is covered by the gradient, so only <span className="font-medium">top, bottom, and right</span> edges are checked. An additional gradient-proximity rule warns when the image left edge retreats past <span className="font-medium">40%</span> of the gradient width.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Smartphone size={13} className="text-[#6e6e73] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                  <span className="font-semibold text-[#1d1d1f]">Mobile formats</span> — The bottom edge is covered by the gradient, so only <span className="font-medium">left, right, and top</span> edges are checked. An additional gradient-proximity rule warns when the image bottom edge retreats past <span className="font-medium">40%</span> of the gradient height.
                </p>
              </div>
            </div>
          </div>
          <RuleRow
            icon={<ZoomIn size={15} />}
            title="Scale range"
            description="The zoom slider ranges from 50% to 150% with 100% as the default midpoint. The Fix button will adjust scale only when position alone cannot resolve coverage gaps."
            severity="info"
          />

          {/* Guide overlay zones */}
          <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-4 mt-1">
            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2.5">Guide overlay zones</p>
            <p className="text-[12px] text-[#6e6e73] leading-relaxed mb-3">
              Toggle Guides in the header to see three colour-coded zones on each banner preview. These zones relate to image composition, not text placement:
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-[#ff3b30]/15 bg-[#ff3b30]/5 p-3 text-center">
                <div className="w-8 h-8 rounded-lg bg-[#ff3b30]/20 border border-[#ff3b30]/20 mx-auto mb-2" />
                <p className="text-[12px] font-semibold text-[#ff3b30]">Blocked</p>
                <p className="text-[11px] text-[#6e6e73] mt-0.5">No key visual interest points from the image should fall in these areas.</p>
              </div>
              <div className="rounded-xl border border-[#34c759]/15 bg-[#34c759]/5 p-3 text-center">
                <div className="w-8 h-8 rounded-lg bg-[#34c759]/20 border border-[#34c759]/20 mx-auto mb-2" />
                <p className="text-[12px] font-semibold text-[#34c759]">Safe area</p>
                <p className="text-[11px] text-[#6e6e73] mt-0.5">Ideal zone for the image's focal points and key subjects.</p>
              </div>
              <div className="rounded-xl border border-[#0071e3]/15 bg-[#0071e3]/5 p-3 text-center">
                <div className="w-8 h-8 rounded-lg bg-[#0071e3]/20 border border-[#0071e3]/20 mx-auto mb-2" />
                <p className="text-[12px] font-semibold text-[#0071e3]">Gradient</p>
                <p className="text-[11px] text-[#6e6e73] mt-0.5">Gradient overlay zone — the image blends into the theme colour here.</p>
              </div>
            </div>
          </div>

          {/* Fix button behavior */}
          <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-4 mt-1">
            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2.5">How the Fix button works</p>
            <p className="text-[12px] text-[#6e6e73] leading-relaxed mb-2.5">
              The Fix button uses a minimal-adjustment solver — the smallest possible change to resolve coverage warnings:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/60">
                <div className="w-5 h-5 rounded-full bg-[#0071e3]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-[#0071e3]">1</span>
                </div>
                <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                  <span className="font-semibold text-[#1d1d1f]">Single edge</span> — Only adjusts position on the relevant axis. Scale and the other axis remain untouched.
                </p>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/60">
                <div className="w-5 h-5 rounded-full bg-[#0071e3]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-[#0071e3]">2</span>
                </div>
                <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                  <span className="font-semibold text-[#1d1d1f]">Multiple edges</span> — Clamps position to the nearest valid point. Only scales up if position alone can't satisfy all constraints.
                </p>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/60">
                <div className="w-5 h-5 rounded-full bg-[#0071e3]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-[#0071e3]">3</span>
                </div>
                <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                  <span className="font-semibold text-[#1d1d1f]">Gradient proximity</span> — For mobile, nudges Y position so the bottom edge sits at the 40% threshold inside the gradient zone. For desktop, nudges X position so the left edge stays within 40% of the gradient width.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ═══════════════════════════════════════════════
            3. GRADIENT & COLOR
            ═══════════════════════════════════════════════ */}
        <SectionCard id="gradient" icon={<Blend size={16} strokeWidth={2} />} title="Gradient & colour">
          <RuleRow
            icon={<Blend size={15} />}
            title="Gradient proximity threshold"
            description="The gradient must blend naturally with the image. If the image edge pulls away from the gradient zone, a warning appears. Desktop checks the X-axis (left edge, 40% of gradient width). Mobile checks the Y-axis (bottom edge, 40% of gradient height)."
            severity="warning"
          />
          <a
            href="#tintsync"
            className="block group cursor-pointer no-underline"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('tintsync')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0071e3]/5 border border-[#0071e3]/10 group-hover:bg-[#0071e3]/10 transition-all">
              <div className="mt-0.5 text-[#0071e3] shrink-0"><Palette size={15} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#1d1d1f]">Auto-theme gradient</span>
                  <Badge color="blue">Info</Badge>
                  <ChevronDown size={12} className="text-[#0071e3] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[12px] text-[#6e6e73] mt-0.5 leading-relaxed">The TintSync engine extracts the dominant colour from the uploaded image using CIELAB colour science, then applies a normalised HSL variant as the gradient overlay and background fill. See the TintSync section below for details.</p>
              </div>
            </div>
          </a>
          <RuleRow
            icon={<Layers size={15} />}
            title="Dynamic gradient hold"
            description="Gradient defaults to 0% solid hold (pure fade). When the image is dragged to reveal a gap on the leading edge, the gradient ramps up proportionally toward the configured gradientStart value."
            severity="info"
          />
        </SectionCard>

        {/* ═══════════════════════════════════════════════
            4. TEXT & COPY RULES
            ═══════════════════════════════════════════════ */}
        <SectionCard id="text" icon={<Type size={16} strokeWidth={2} />} title="Text & copy rules">
          <p className="text-[12px] text-[#6e6e73] leading-relaxed -mt-0.5 mb-1">
            All text fields — title, subtitle, and button — are validated in real-time. Rules are split into <span className="font-semibold text-[#ff3b30]">export blockers</span> and <span className="font-semibold text-[#ff9f0a]">advisory warnings</span>.
          </p>

          {/* Errors sub-group — driven by registry */}
          <div className="rounded-xl border border-[#ff3b30]/10 bg-[#ff3b30]/[0.02] p-4 space-y-2">
            <p className="text-[12px] font-semibold text-[#ff3b30] tracking-wider mb-0.5">Export blockers</p>
            {getTextErrors().map((rule) => (
              <RuleRow
                key={rule.id}
                icon={resolveIcon(rule.icon)}
                title={rule.title}
                description={rule.description}
                severity={rule.severity}
              />
            ))}
          </div>

          {/* Warnings sub-group — driven by registry */}
          <div className="rounded-xl border border-[#ff9f0a]/10 bg-[#ff9f0a]/[0.02] p-4 space-y-2">
            <p className="text-[12px] font-semibold text-[#ff9f0a] tracking-wider mb-0.5">Warnings</p>
            {getTextWarnings().map((rule) => (
              <RuleRow
                key={rule.id}
                icon={resolveIcon(rule.icon)}
                title={rule.title}
                description={rule.description}
                severity={rule.severity}
              />
            ))}
          </div>
        </SectionCard>

        {/* ═══════════════════════════════════════════════
            5. CAPITALISATION — per-language deep-dive
            ═══════════════════════════════════════════════ */}
        <SectionCard id="capitalisation" icon={<Globe size={16} strokeWidth={2} />} title="Capitalisation & language rules">
          <p className="text-[12px] text-[#6e6e73] leading-relaxed -mt-0.5 mb-1">
            Capitalisation rules are enforced per-language based on official product copy guidelines. The core principle across all languages: <span className="font-semibold text-[#1d1d1f]">sentence case is the default</span>. Capitalisation for emphasis (e.g. FREE delivery) is the exception and must be intentional.
          </p>

          {/* Per-language cards — driven by registry */}
          {LANGUAGE_CAP_GUIDES.map((lang) => (
            <div key={lang.code} className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Badge color="blue">{lang.name}</Badge>
                <span className="text-[11px] text-[#86868b]">{lang.shortLabel}</span>
              </div>
              <p className="text-[12px] text-[#6e6e73] leading-relaxed mb-2.5">
                {lang.description}
              </p>
              {lang.hasCase && lang.correctExamples.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 text-[12px]">
                    <span className="text-[#34c759] shrink-0 mt-px">&#10003;</span>
                    <span className="text-[#6e6e73]">
                      {lang.correctExamples.map((ex, i) => (
                        <span key={i}>
                          {i > 0 && ' \u00b7 '}
                          <span className="font-medium text-[#1d1d1f]">{ex}</span>
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-[12px]">
                    <span className="text-[#ff3b30] shrink-0 mt-px">&#10007;</span>
                    <span className="text-[#6e6e73]">
                      {lang.incorrectExamples.map((ex, i) => (
                        <span key={i}>
                          {i > 0 && ' \u00b7 '}
                          <span className="font-medium text-[#1d1d1f]">{ex.text}</span>
                          {' '}({ex.note})
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              )}
              {/* Chinese: auto-render rules from registry */}
              {!lang.hasCase && (
                <ul className="text-[12px] text-[#6e6e73] leading-relaxed space-y-1.5 list-none pl-0">
                  {getChineseRules().map((rule) => (
                    <li key={rule.id} className="flex items-start gap-2">
                      <span className="text-[#0071e3] mt-0.5 shrink-0">&#8226;</span>
                      {rule.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* Known acronyms exclusion list — driven by registry */}
          <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge color="gray">Known acronyms</Badge>
            </div>
            <p className="text-[12px] text-[#6e6e73] leading-relaxed mb-2.5">
              These ALL CAPS words are recognised as acronyms and are <span className="font-semibold text-[#1d1d1f]">never flagged</span> by the block-caps rule:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(KNOWN_ACRONYMS).sort().map((acr) => (
                <span key={acr} className="px-2 py-0.5 rounded-md bg-white/60 border border-black/[0.06] text-[11px] font-mono font-medium text-[#1d1d1f]">
                  {acr}
                </span>
              ))}
            </div>
          </div>

          {/* What applies where — auto-generated from registry scopes */}
          <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge color="gray">All languages</Badge>
            </div>
            <ul className="text-[12px] text-[#6e6e73] leading-relaxed space-y-1.5 list-none pl-0">
              {getUniversalRules().errors.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-[#ff3b30] mt-0.5 shrink-0">&#8226;</span>
                  <span>{getUniversalRules().errors.map(r => r.title).join(', ')} apply to <span className="font-medium text-[#1d1d1f]">every language</span></span>
                </li>
              )}
              {getUniversalRules().warnings.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-[#ff9f0a] mt-0.5 shrink-0">&#8226;</span>
                  <span>{getUniversalRules().warnings.map(r => r.title).join(', ')} apply to every language</span>
                </li>
              )}
            </ul>
          </div>
        </SectionCard>

        {/* ═══════════════════════════════════════════════
            6. EXPORT
            ═══════════════════════════════════════════════ */}
        <SectionCard id="export" icon={<Download size={16} strokeWidth={2} />} title="Export">
          <RuleRow
            icon={<ShieldAlert size={15} />}
            title="Export gating"
            description="The Export all button turns red when any selected format has blocking errors. Clicking it opens a modal listing all unresolved issues. Individual format export buttons are also gated."
            severity="error"
          />
          <RuleRow
            icon={<ShieldCheck size={15} />}
            title="Warnings don't block"
            description="Coverage warnings, sentence-case suggestions, and whitespace issues are advisory. You can export with active warnings — but we recommend fixing them for the best result."
            severity="warning"
          />
        </SectionCard>

        {/* ═══════════════════════════════════════════════
            7. TINTSYNC ENGINE
            ═══════════════════════════════════════════════ */}
        <div id="tintsync" className="scroll-mt-28 rounded-2xl overflow-hidden shadow-[0_2px_32px_rgba(0,113,227,0.12)] border border-white/20 relative">
          {/* Animated gradient background */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute -inset-[50%] opacity-30"
              style={{
                background: 'conic-gradient(from 0deg at 50% 50%, #0071e3, #5856d6, #af52de, #ff2d55, #ff9500, #ffcc00, #34c759, #00c7be, #0071e3)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute -inset-[50%] opacity-20"
              style={{
                background: 'conic-gradient(from 180deg at 50% 50%, #5856d6, #0071e3, #00c7be, #34c759, #ffcc00, #ff9500, #ff2d55, #af52de, #5856d6)',
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-[#1d1d1f]/85 backdrop-blur-3xl" />

          <div className="relative z-10 px-8 py-14 text-center">
            {/* Header — centered, no icon */}
            <div className="mb-2">
              <h2 className="font-bold text-white tracking-tight p-[0px] text-[48px]" style={{ background: 'linear-gradient(135deg, #fff 0%, #fff 40%, #5ac8fa 60%, #bf5af2 80%, #ff2d55 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TintSync</h2>
              <p className="text-[15px] text-white/40 tracking-[0.2em] m-[0px]">Engine</p>
            </div>

            {/* Description */}
            <p className="text-[13px] text-white/70 leading-relaxed max-w-[520px] mx-auto mx-[47px] mt-[20px] mb-[40px]">
              TintSync automatically picks the most visually prominent colour from your product image and uses it to theme the entire banner — the gradient overlay, the background fill, and the text contrast are all derived from that one colour. No manual colour picking needed.
            </p>

            {/* Pipeline steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10 text-left">
              {[
                { step: 1, icon: <Scan size={15} strokeWidth={2} />, title: 'Border detection', description: "Ignores plain-coloured edges and white borders around your image so they don't skew the colour result. Only the actual product area is sampled.", color: '#00c7be' },
                { step: 2, icon: <Pipette size={15} strokeWidth={2} />, title: 'Colour sampling', description: 'Scans every pixel and prioritises rich, saturated colours over dull greys, blacks, and whites. The more vibrant and prominent a colour is, the more weight it carries.', color: '#5856d6' },
                { step: 3, icon: <Layers size={15} strokeWidth={2} />, title: 'Colour grouping', description: "Groups similar colours together into clusters and picks the largest, most dominant group. If one colour clearly stands out, it's selected instantly as a shortcut.", color: '#0071e3' },
                { step: 4, icon: <Sun size={15} strokeWidth={2} />, title: 'Contrast adjustment', description: "Darkens the winning colour just enough to guarantee white text stays readable on top of it — meeting a minimum 6:1 contrast ratio for accessibility.", color: '#af52de' },
              ].map((props, idx) => (
                <PipelineStep key={props.step} {...props} delay={idx * 0.08} />
              ))}
            </div>

            {/* Color space visualization */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 text-left">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Contrast size={14} strokeWidth={2} className="text-white/50" />
                <span className="text-[12px] font-semibold text-white/60 tracking-wider">Colour space pipeline</span>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {['sRGB input', 'Linear RGB', 'XYZ D65', 'CIELAB L*a*b*', 'K-Means++', 'Dominant Lab', 'RGB', 'HSL', 'Normalised'].map((label, i, arr) => (
                  <motion.span
                    key={label}
                    className="contents"
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap ${
                      i === 3 ? 'bg-[#0071e3]/30 text-[#5ac8fa] border border-[#0071e3]/30' :
                      i === 4 ? 'bg-[#5856d6]/30 text-[#bf5af2] border border-[#5856d6]/30' :
                      i === arr.length - 1 ? 'bg-[#34c759]/20 text-[#30d158] border border-[#34c759]/30' :
                      'bg-white/8 text-white/50 border border-white/8'
                    }`}>
                      {label}
                    </span>
                    {i < arr.length - 1 && (
                      <ArrowRight size={10} className="text-white/20 shrink-0" />
                    )}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex flex-col items-center gap-2">
              <div className="flex gap-1.5">
                {['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0071e3', '#5856d6', '#af52de', '#ff2d55'].map((c, i) => (
                  <motion.div
                    key={c}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c }}
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 0.7 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', damping: 12, stiffness: 300, delay: i * 0.04 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TintSync Pipeline Step ─────────────────────────── */

function PipelineStep({ step, icon, title, description, color, delay = 0 }: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      className="rounded-xl border border-white/8 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/8 transition-colors"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
        >
          <span className="text-[10px] font-bold" style={{ color }}>{step}</span>
        </div>
        <div style={{ color }} className="shrink-0">{icon}</div>
        <span className="text-[13px] font-semibold text-white">{title}</span>
      </div>
      <p className="text-[11px] text-white/50 leading-relaxed pl-[34px]">{description}</p>
    </motion.div>
  );
}