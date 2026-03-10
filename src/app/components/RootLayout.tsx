import { useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Generator } from './Generator';
import { GuidelinesPage } from './GuidelinesPage';

export function RootLayout() {
  const location = useLocation();
  const isGuidelines = location.pathname === '/guidelines';

  return (
    <>
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
