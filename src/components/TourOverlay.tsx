import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { TourState } from '../hooks/useTour';

interface TourOverlayProps {
  tour: TourState;
  onSwitchPanel: (panel: 'settings' | 'tracker' | null) => void;
}

export const TourOverlay: React.FC<TourOverlayProps> = ({ tour, onSwitchPanel }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<'above' | 'below'>('below');
  const observerRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef(0);

  const step = tour.steps[tour.currentStep];

  const measureTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.selector}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
      setTooltipPos(r.top > window.innerHeight / 2 ? 'above' : 'below');
    } else {
      setRect(null);
    }
  }, [step]);

  // Switch panel and open settings sections if needed, then measure
  useEffect(() => {
    if (!tour.isActive || !step) return;

    let cancelled = false;
    const timers: number[] = [];

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    };

    // Switch the panel
    if (step.panel) {
      onSwitchPanel(step.panel);
    } else {
      onSwitchPanel(null);
    }

    // Open settings accordion section if needed (delay so panel renders first)
    if (step.settingsSection) {
      schedule(() => {
        window.dispatchEvent(new CustomEvent('pokepelago_tour_open_section', {
          detail: step.settingsSection,
        }));
      }, 60);
    }

    // Retry measurement to wait for panels/sections to render
    let attempts = 0;
    const tryMeasure = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.selector}"]`);
      if (el) {
        measureTarget();
      } else if (attempts < 20) {
        attempts++;
        schedule(tryMeasure, 80);
      } else {
        measureTarget(); // Will set rect to null (fallback)
      }
    };

    // Initial delay to let React commit the panel switch
    schedule(tryMeasure, 120);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [tour.isActive, tour.currentStep, step, onSwitchPanel, measureTarget]);

  // ResizeObserver + scroll/resize listeners
  useEffect(() => {
    if (!tour.isActive || !step) return;

    const el = document.querySelector(`[data-tour="${step.selector}"]`);

    const handleResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measureTarget);
    };

    if (el) {
      observerRef.current = new ResizeObserver(handleResize);
      observerRef.current.observe(el);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [tour.isActive, step, measureTarget]);

  // Keyboard navigation
  useEffect(() => {
    if (!tour.isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tour.skip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') tour.next();
      else if (e.key === 'ArrowLeft') tour.back();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tour]);

  if (!tour.isActive || !step) return null;

  const PAD = 8;
  const RADIUS = 12;

  // Cutout rect or fallback to center
  const cx = rect ? rect.left - PAD : 0;
  const cy = rect ? rect.top - PAD : 0;
  const cw = rect ? rect.width + PAD * 2 : 0;
  const ch = rect ? rect.height + PAD * 2 : 0;

  // Tooltip position
  const maxW = Math.min(320, window.innerWidth - 16);
  const leftPos = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - maxW - 8)) : undefined;
  const isTall = rect ? rect.height > window.innerHeight * 0.5 : false;

  let tooltipStyle: React.CSSProperties;
  if (!rect) {
    tooltipStyle = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: maxW };
  } else if (isTall) {
    // Element is taller than half the viewport - place tooltip near the top of the element
    tooltipStyle = { position: 'fixed', top: Math.max(rect.top + 16, 80), left: leftPos, maxWidth: maxW };
  } else if (tooltipPos === 'below') {
    tooltipStyle = { position: 'fixed', top: rect.bottom + 16, left: leftPos, maxWidth: maxW };
  } else {
    tooltipStyle = { position: 'fixed', bottom: window.innerHeight - rect.top + 16, left: leftPos, maxWidth: maxW };
  }

  return (
    <div className="fixed inset-0 z-[55] tour-overlay">
      {/* SVG overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                className="tour-spotlight-rect"
                x={cx}
                y={cy}
                width={cw}
                height={ch}
                rx={RADIUS}
                ry={RADIUS}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto', cursor: 'default' }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Click-through zone over the highlighted element */}
      {rect && (
        <div
          className="fixed"
          style={{
            left: cx, top: cy, width: cw, height: ch,
            pointerEvents: 'none',
            zIndex: 56,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 tour-tooltip"
        style={{ ...tooltipStyle, zIndex: 57, pointerEvents: 'auto' }}
      >
        {!rect && (
          <p className="text-[10px] text-yellow-500 mb-2">Element not visible - it may be off-screen.</p>
        )}
        <h3 className="text-sm font-bold text-white mb-1">{step.title}</h3>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">{step.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-600">
            {tour.currentStep + 1} of {tour.steps.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={tour.skip}
              className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip
            </button>
            {tour.currentStep > 0 && (
              <button
                onClick={tour.back}
                className="px-3 py-1.5 text-[10px] font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={tour.next}
              className="px-3 py-1.5 text-[10px] font-bold text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
            >
              {tour.currentStep === tour.steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
