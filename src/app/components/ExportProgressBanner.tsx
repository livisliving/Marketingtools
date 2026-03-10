import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, Package, X } from 'lucide-react';

export type ExportPhase = 'rendering' | 'zipping' | 'done';

export interface ExportProgress {
  phase: ExportPhase;
  current: number;
  total: number;
  currentLabel: string; // e.g. "Homepage Hero · EN"
}

interface ExportProgressBannerProps {
  progress: ExportProgress | null;
  onDismiss: () => void;
}

export function ExportProgressBanner({ progress, onDismiss }: ExportProgressBannerProps) {
  return (
    <AnimatePresence>
      {progress && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] w-[420px] max-w-[calc(100vw-32px)]"
        >
          <div className="bg-white/80 backdrop-blur-2xl rounded-2xl border border-white/50 shadow-[0_8px_40px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Progress bar at top */}
            <div className="h-[3px] bg-black/[0.04] overflow-hidden">
              {progress.phase === 'done' ? (
                <motion.div
                  className="h-full bg-[#30d158]"
                  initial={{ width: '90%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.3 }}
                />
              ) : progress.phase === 'zipping' ? (
                <motion.div
                  className="h-full bg-[#0071e3]"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: 'easeInOut' }}
                />
              ) : (
                <motion.div
                  className="h-full bg-[#0071e3]"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </div>

            <div className="flex items-center gap-3.5 px-4 py-3">
              {/* Icon */}
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
                progress.phase === 'done'
                  ? 'bg-[#30d158]/10'
                  : 'bg-[#0071e3]/10'
              }`}>
                {progress.phase === 'done' ? (
                  <CheckCircle2 size={18} className="text-[#30d158]" />
                ) : progress.phase === 'zipping' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <Package size={18} className="text-[#0071e3]" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <Loader2 size={18} className="text-[#0071e3]" />
                  </motion.div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1d1d1f]">
                  {progress.phase === 'done'
                    ? 'Export complete'
                    : progress.phase === 'zipping'
                    ? 'Packaging ZIP...'
                    : `Rendering ${progress.current} of ${progress.total}`}
                </div>
                <div className="text-[12px] text-[#86868b] truncate mt-0.5">
                  {progress.phase === 'done'
                    ? `${progress.total} banner${progress.total !== 1 ? 's' : ''} exported successfully`
                    : progress.currentLabel}
                </div>
              </div>

              {/* Counter / Dismiss */}
              {progress.phase === 'done' ? (
                <button
                  onClick={onDismiss}
                  className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-black/[0.05] text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              ) : (
                <span className="text-[12px] font-medium text-[#86868b] tabular-nums shrink-0">
                  {Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
