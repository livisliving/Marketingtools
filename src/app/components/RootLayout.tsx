import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, X } from 'lucide-react';
import { Generator } from './Generator';
import { GuidelinesPage } from './GuidelinesPage';
import { startUpdatePolling } from '../utils/version-check';

export function RootLayout() {
  const location = useLocation();
  const isGuidelines = location.pathname === '/guidelines';

  // "New version available" check (GitHub Pages). No-op offline / when not hosted.
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => startUpdatePolling(() => setUpdateAvailable(true)), []);

  return (
    <>
      <AnimatePresence>
        {updateAvailable && !dismissed && (
          <motion.div
            key="update-banner"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-[#1d1d1f] text-white rounded-full pl-4 pr-2 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
          >
            <span className="text-[13px] font-medium whitespace-nowrap">
              A new version is available
            </span>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 text-[13px] font-semibold bg-white text-[#1d1d1f] rounded-full px-3 py-1.5 hover:bg-white/90 active:scale-[0.97] transition-all cursor-pointer"
            >
              <RefreshCw size={14} strokeWidth={2.5} />
              Refresh
            </button>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="flex items-center justify-center w-7 h-7 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generator stays mounted but hidden when on guidelines */}
      <div style={{ display: isGuidelines ? 'none' : undefined }}>
        <Generator />
      </div>
      <AnimatePresence>
        {isGuidelines && (
          <motion.div
            key="guidelines"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <GuidelinesPage />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
