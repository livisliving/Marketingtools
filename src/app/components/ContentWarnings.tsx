import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, XCircle, X, ChevronDown } from 'lucide-react';
import type { ContentWarning } from '../utils/content-rules';

interface ContentWarningTooltipProps {
  warnings: ContentWarning[];
  onApplySuggestion?: (field: string, suggestion: string) => void;
}

export function ContentWarningTooltip({ warnings, onApplySuggestion }: ContentWarningTooltipProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevWarningIds = useRef('');

  // Reset dismissed state when the set of warnings changes
  useEffect(() => {
    const currentIds = warnings.map(w => w.id).sort().join(',');
    if (currentIds !== prevWarningIds.current) {
      prevWarningIds.current = currentIds;
      if (dismissed) setDismissed(false);
    }
  }, [warnings, dismissed]);

  if (warnings.length === 0 || dismissed) return null;

  const errorCount = warnings.filter(w => w.severity === 'error').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;

  const getFieldLabel = (id: string) => {
    if (id.startsWith('title-')) return 'Title';
    if (id.startsWith('sub-')) return 'Subtitle';
    if (id.startsWith('btn-')) return 'Button';
    return '';
  };

  const getFieldKey = (id: string) => {
    if (id.startsWith('title-')) return 'title';
    if (id.startsWith('sub-')) return 'subtitle';
    if (id.startsWith('btn-')) return 'button';
    return '';
  };

  return (
    <div className="sticky top-4 float-right z-50 mr-0" style={{ maxWidth: '340px' }}>
      {/* Collapsed pill */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-2xl shadow-lg border transition-all hover:scale-[1.02] active:scale-[0.98] ${
            errorCount > 0
              ? 'bg-[#ff3b30]/90 border-[#ff3b30]/30 text-white'
              : 'bg-[#ff9500]/90 border-[#ff9500]/30 text-white'
          }`}
        >
          {errorCount > 0 ? (
            <XCircle size={14} strokeWidth={2.5} />
          ) : (
            <AlertTriangle size={14} strokeWidth={2.5} />
          )}
          <span className="text-[12px] font-semibold whitespace-nowrap">
            {warnings.length} {warnings.length === 1 ? 'issue' : 'issues'}
          </span>
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      )}

      {/* Expanded tooltip */}
      {expanded && (
        <div className="bg-white/85 backdrop-blur-2xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-black/[0.06] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06]">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${errorCount > 0 ? 'bg-[#ff3b30]' : 'bg-[#ff9500]'}`} />
              <span className="text-[13px] font-semibold text-[#1d1d1f]">
                Content {warnings.length === 1 ? 'Issue' : 'Issues'}
              </span>
              <span className="text-[11px] text-[#86868b] font-medium">
                {errorCount > 0 && `${errorCount} error${errorCount > 1 ? 's' : ''}`}
                {errorCount > 0 && warningCount > 0 && ', '}
                {warningCount > 0 && `${warningCount} warning${warningCount > 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(false)}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors text-[#86868b] hover:text-[#1d1d1f]"
              >
                <ChevronDown size={14} className="rotate-180" />
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors text-[#86868b] hover:text-[#1d1d1f]"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Warning list */}
          <div className="p-2 space-y-1 max-h-[280px] overflow-y-auto">
            {warnings.map((w) => {
              const fieldLabel = getFieldLabel(w.id);
              const fieldKey = getFieldKey(w.id);
              return (
                <div
                  key={w.id}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${
                    w.severity === 'error'
                      ? 'bg-[#ff3b30]/6 hover:bg-[#ff3b30]/10'
                      : 'bg-[#ff9500]/6 hover:bg-[#ff9500]/10'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {w.severity === 'error' ? (
                      <XCircle size={14} className="text-[#ff3b30]" strokeWidth={2.5} />
                    ) : (
                      <AlertTriangle size={14} className="text-[#ff9500]" strokeWidth={2.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">{fieldLabel}</span>
                    </div>
                    <p className={`text-[12px] font-medium leading-snug ${
                      w.severity === 'error' ? 'text-[#cc2d26]' : 'text-[#996600]'
                    }`}>
                      {w.message}
                    </p>
                    {w.suggestion && onApplySuggestion && (
                      <button
                        onClick={() => onApplySuggestion(fieldKey, w.suggestion!)}
                        className={`mt-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                          w.severity === 'error'
                            ? 'bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/20'
                            : 'bg-[#ff9500]/10 text-[#cc7700] hover:bg-[#ff9500]/20'
                        }`}
                      >
                        Fix: "{w.suggestion}"
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}