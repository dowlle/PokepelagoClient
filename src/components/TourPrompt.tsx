import React, { useEffect } from 'react';
import type { TourMode } from '../hooks/useTour';

interface TourPromptProps {
  visible: boolean;
  onStart: (mode: TourMode) => void;
  onDismiss: () => void;
  gameMode: TourMode;
}

export const TourPrompt: React.FC<TourPromptProps> = ({ visible, onStart, onDismiss, gameMode }) => {
  // Auto-hide after 10 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 10000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div className="absolute left-0 right-0 z-30 flex justify-center px-4 tour-tooltip" style={{ top: '100%' }}>
      <div className="mt-2 flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl px-4 py-2.5 max-w-md">
        <span className="text-xs text-gray-300">Welcome to Pokepelago! Want a quick tour?</span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { onStart(gameMode); }}
            className="px-3 py-1 text-[10px] font-bold text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
          >
            Take the Tour
          </button>
          <button
            onClick={() => { onDismiss(); }}
            className="px-3 py-1 text-[10px] font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
};
