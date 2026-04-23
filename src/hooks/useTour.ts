import { useState, useCallback } from 'react';

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  panel?: 'settings' | 'tracker';
  openModal?: 'settings';
  settingsSection?: string;
}

const ARCHIPELAGO_STEPS: TourStep[] = [
  {
    id: 'guess-input',
    selector: 'guess-input',
    title: 'Guess Pokemon',
    description: 'Type a Pokemon name here. Guesses auto-submit when a match is found, no Enter needed!',
  },
  {
    id: 'lang-selector',
    selector: 'lang-selector',
    title: 'Change Language',
    description: 'Switch between 11 languages for Pokemon names. English, Japanese, French, and more.',
  },
  {
    id: 'stats-counter',
    selector: 'stats-counter',
    title: 'Your Progress',
    description: 'Track how many Pokemon you\'ve guessed toward your goal.',
  },
  {
    id: 'dex-region',
    selector: 'dex-region',
    title: 'Pokemon Grid',
    description: 'Pokemon are organized by region. Click headers to collapse, drag to reorder. A colored dot means guessable.',
  },
  {
    id: 'log-toggle',
    selector: 'log-toggle',
    title: 'Activity Log',
    description: 'Toggle the log sidebar to see incoming items, hint messages, and connection events from the multiworld.',
  },
  {
    id: 'tracker-tab',
    selector: 'tracker-tab',
    title: 'Tracker',
    description: 'View your type unlock progress and gate items here. Shows what items you\'ve received from the multiworld.',
  },
  {
    id: 'settings-tab',
    selector: 'settings-tab',
    title: 'Settings',
    description: 'Configure sprites, display, generations, connection, and Twitch integration.',
  },
  {
    id: 'sprite-url',
    selector: 'sprite-url',
    title: 'Add Sprites',
    description: 'Paste a GitHub sprite URL to display Pokemon images. Check the splash screen for a quick setup link.',
    openModal: 'settings',
    settingsSection: 'sprites',
  },
  {
    id: 'shadow-toggle',
    selector: 'shadow-toggle',
    title: 'Shadow Mode',
    description: 'Enable shadows to show silhouettes for unguessed Pokemon, like "Who\'s That Pokemon?" Requires sprites.',
    openModal: 'settings',
    settingsSection: 'interface',
  },
  {
    id: 'type-grid',
    selector: 'type-grid',
    title: 'Type Filters',
    description: 'Click a type to filter the grid. Ctrl+Click for multi-select. Locked types show which Type Keys you still need.',
    panel: 'tracker',
  },
];

const STANDALONE_STEPS: TourStep[] = [
  { ...ARCHIPELAGO_STEPS[0] },
  { ...ARCHIPELAGO_STEPS[1] },
  {
    ...ARCHIPELAGO_STEPS[2],
    description: 'Track how many Pokemon you\'ve guessed.',
  },
  {
    ...ARCHIPELAGO_STEPS[3],
    description: 'Pokemon are organized by region. Click headers to collapse, drag to reorder. A colored dot means guessable.',
  },
  {
    ...ARCHIPELAGO_STEPS[7],
    description: 'Paste a GitHub sprite URL to display Pokemon images.',
  },
  {
    ...ARCHIPELAGO_STEPS[8],
  },
];

const LS_COMPLETED = 'pokepelago_tour_completed';
const LS_SEEN_PROMPT = 'pokepelago_tour_seen_prompt';

export type TourMode = 'archipelago' | 'standalone';

export interface TourState {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  tourMode: TourMode | null;
  start: (mode: TourMode) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
  shouldShowPrompt: boolean;
  dismissPrompt: () => void;
}

export function useTour(): TourState {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourMode, setTourMode] = useState<TourMode | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(() =>
    localStorage.getItem(LS_SEEN_PROMPT) === 'true' || localStorage.getItem(LS_COMPLETED) === 'true'
  );

  const steps = tourMode === 'standalone' ? STANDALONE_STEPS : ARCHIPELAGO_STEPS;

  const start = useCallback((mode: TourMode) => {
    setTourMode(mode);
    setCurrentStep(0);
    setIsActive(true);
    setPromptDismissed(true);
    localStorage.setItem(LS_SEEN_PROMPT, 'true');
  }, []);

  const complete = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(LS_COMPLETED, 'true');
  }, []);

  const next = useCallback(() => {
    setCurrentStep(prev => {
      if (prev >= steps.length - 1) {
        setIsActive(false);
        localStorage.setItem(LS_COMPLETED, 'true');
        return 0;
      }
      return prev + 1;
    });
  }, [steps.length]);

  const back = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const skip = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(LS_COMPLETED, 'true');
  }, []);

  const dismissPrompt = useCallback(() => {
    setPromptDismissed(true);
    localStorage.setItem(LS_SEEN_PROMPT, 'true');
  }, []);

  return {
    isActive,
    currentStep,
    steps,
    tourMode,
    start,
    next,
    back,
    skip,
    complete,
    shouldShowPrompt: !promptDismissed,
    dismissPrompt,
  };
}
