import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export type PillSeverity = 'success' | 'warning' | 'error';

export interface StatusPillData {
  id: string;
  label: string;
  severity: PillSeverity;
  headline: string;
  details?: string;
  suggestion?: string;
  fixLabel?: string;
  onFix?: () => void;
}

const SEVERITY_CONFIG = {
  success: {
    bg: 'bg-[#34c759]/10',
    border: 'border-[#34c759]/20',
    text: 'text-[#248a3d]',
    iconColor: 'text-[#34c759]',
    dotColor: 'bg-[#34c759]',
    tooltipBg: 'bg-white/90',
    tooltipBorder: 'border-[#34c759]/15',
    tooltipText: 'text-[#248a3d]',
    tooltipDetailText: 'text-[#1d1d1f]',
  },
  warning: {
    bg: 'bg-[#ff9500]/10',
    border: 'border-[#ff9500]/20',
    text: 'text-[#cc7700]',
    iconColor: 'text-[#ff9500]',
    dotColor: 'bg-[#ff9500]',
    tooltipBg: 'bg-white/90',
    tooltipBorder: 'border-[#ff9500]/15',
    tooltipText: 'text-[#cc7700]',
    tooltipDetailText: 'text-[#1d1d1f]',
  },
  error: {
    bg: 'bg-[#ff3b30]/10',
    border: 'border-[#ff3b30]/20',
    text: 'text-[#d70015]',
    iconColor: 'text-[#ff3b30]',
    dotColor: 'bg-[#ff3b30]',
    tooltipBg: 'bg-white/90',
    tooltipBorder: 'border-[#ff3b30]/15',
    tooltipText: 'text-[#d70015]',
    tooltipDetailText: 'text-[#1d1d1f]',
  },
};

const SeverityIcon = ({ severity, size = 12 }: { severity: PillSeverity; size?: number }) => {
  const cls = SEVERITY_CONFIG[severity].iconColor;
  if (severity === 'success') return <CheckCircle2 size={size} strokeWidth={2.5} className={cls} />;
  if (severity === 'error') return <XCircle size={size} strokeWidth={2.5} className={cls} />;
  return <AlertTriangle size={size} strokeWidth={2.5} className={cls} />;
};

export function StatusPill({ data }: { data: StatusPillData }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipSide, setTooltipSide] = useState<'bottom' | 'top'>('bottom');
  const pillRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const s = SEVERITY_CONFIG[data.severity];

  // Track previous severity for transition animation
  const prevSeverity = useRef(data.severity);
  const [severityChanged, setSeverityChanged] = useState(false);

  useEffect(() => {
    if (data.severity !== prevSeverity.current) {
      prevSeverity.current = data.severity;
      setSeverityChanged(true);
      const t = setTimeout(() => setSeverityChanged(false), 400);
      return () => clearTimeout(t);
    }
  }, [data.severity]);

  useEffect(() => {
    if (hovered && pillRef.current) {
      const rect = pillRef.current.getBoundingClientRect();
      setTooltipSide(rect.top < 200 ? 'bottom' : 'bottom');
    }
  }, [hovered]);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setHovered(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setHovered(false), 150);
  };

  return (
    <div
      ref={pillRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* The pill */}
      <motion.div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-default select-none ${s.bg} ${s.border}`}
        animate={{
          scale: severityChanged ? [1, 1.12, 1] : (hovered ? 1.03 : 1),
        }}
        transition={severityChanged ? { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] } : { duration: 0.15 }}
        layout
      >
        <motion.div
          key={data.severity}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 400 }}
        >
          <SeverityIcon severity={data.severity} size={12} />
        </motion.div>
        <span className={`text-[11px] font-semibold tracking-tight whitespace-nowrap ${s.text}`}>
          {data.label}
        </span>
      </motion.div>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            className={`absolute z-[60] left-0 ${
              tooltipSide === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
            }`}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <div
              className={`rounded-2xl backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] border overflow-hidden min-w-[220px] max-w-[300px] ${s.tooltipBg} ${s.tooltipBorder}`}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-black/[0.05]">
                <SeverityIcon severity={data.severity} size={14} />
                <span className={`text-[12px] font-semibold ${s.tooltipText}`}>
                  {data.headline}
                </span>
              </div>

              {/* Body */}
              {(data.details || data.suggestion) && (
                <div className="px-3.5 py-2.5 space-y-2">
                  {data.details && (() => {
                    const items = data.details.split(' · ');
                    if (items.length <= 1) {
                      return (
                        <p className={`text-[11px] leading-relaxed ${s.tooltipDetailText} opacity-70`}>
                          {data.details}
                        </p>
                      );
                    }
                    return (
                      <ul className="space-y-1">
                        {items.map((item, i) => (
                          <li key={i} className={`text-[11px] leading-relaxed ${s.tooltipDetailText} opacity-70 flex items-start gap-1.5`}>
                            <span className={`mt-[5px] w-[5px] h-[5px] rounded-full flex-shrink-0 ${s.dotColor}`} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  {data.onFix && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onFix?.();
                        setHovered(false);
                      }}
                      className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                        data.severity === 'error'
                          ? 'bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/20'
                          : 'bg-[#ff9500]/10 text-[#cc7700] hover:bg-[#ff9500]/20'
                      }`}
                    >
                      {data.fixLabel || (data.suggestion ? `Fix: "${data.suggestion}"` : 'Fix')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
