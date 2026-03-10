import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, XCircle, AlertTriangle, X, Wand2 } from 'lucide-react';
import type { StatusPillData } from './StatusPill';

interface ExportBlockedCardProps {
  /** Format name shown in the header */
  formatName?: string;
  /** Only error-severity pills — the blocking issues */
  errors: StatusPillData[];
  /** Close/dismiss the card */
  onClose: () => void;
}

export function ExportBlockedCard({ formatName, errors, onClose }: ExportBlockedCardProps) {
  const fixableErrors = errors.filter(e => e.onFix);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={onClose}>
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />

      {/* Card */}
      <motion.div
        className="relative bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] border border-black/[0.06] max-w-[420px] w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 380, mass: 0.8 }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <motion.div
            className="w-10 h-10 rounded-2xl bg-[#ff3b30]/10 flex items-center justify-center flex-shrink-0 mt-0.5"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 300, delay: 0.1 }}
          >
            <ShieldAlert size={20} className="text-[#ff3b30]" strokeWidth={2} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">
              Export Blocked
            </h3>
            <p className="text-[13px] text-[#86868b] mt-0.5">
              {formatName
                ? `${formatName} has ${errors.length} ${errors.length === 1 ? 'issue' : 'issues'} that must be resolved before exporting.`
                : `${errors.length} ${errors.length === 1 ? 'issue' : 'issues'} must be resolved before exporting.`
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/5 transition-colors text-[#86868b] hover:text-[#1d1d1f] flex-shrink-0 -mt-0.5 -mr-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-6 border-t border-black/[0.06]" />

        {/* Issue list */}
        <div className="px-4 py-3 space-y-1.5 max-h-[320px] overflow-y-auto">
          {errors.map((err, i) => (
            <motion.div
              key={err.id}
              className="flex items-start gap-3 px-3 py-3 rounded-2xl bg-[#ff3b30]/[0.04] hover:bg-[#ff3b30]/[0.07] transition-colors"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.12 + i * 0.05 }}
            >
              <XCircle size={15} className="text-[#ff3b30] flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
                    {err.label}
                  </span>
                </div>
                <p className="text-[12px] font-medium text-[#d70015] leading-snug">
                  {err.headline}
                </p>
                {err.details && (
                  <p className="text-[11px] text-[#1d1d1f]/60 mt-0.5 leading-relaxed">
                    {err.details}
                  </p>
                )}
                {err.onFix && err.suggestion && (
                  <button
                    onClick={() => err.onFix?.()}
                    className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/20 transition-colors flex items-center gap-1.5"
                  >
                    <Wand2 size={11} strokeWidth={2.5} />
                    Fix: "{err.suggestion}"
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/[0.06] flex items-center justify-between gap-3">
          {fixableErrors.length > 1 && (
            <button
              onClick={() => {
                fixableErrors.forEach(e => e.onFix?.());
              }}
              className="text-[13px] font-semibold text-[#ff3b30] hover:text-[#d70015] transition-colors flex items-center gap-1.5"
            >
              <Wand2 size={13} strokeWidth={2.5} />
              Fix all ({fixableErrors.length})
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-[0.97] text-[#1d1d1f] px-5 py-2 rounded-full text-[13px] font-semibold transition-all"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </div>
  );
}
