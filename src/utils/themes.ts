/**
 * Theme system for Pokepelago.
 *
 * Each theme defines a set of CSS custom property values.  The active theme's
 * variables are applied to :root via `applyTheme()`.  Components reference
 * `var(--pp-*)` instead of hardcoded Tailwind color classes for any value that
 * should change between themes.
 *
 * The "default" theme reproduces the existing dark-gray look.
 * The "pokemon" theme uses bold colours inspired by the Pokemon game UI.
 */

export type ThemeId = 'default' | 'pokemon';

export interface ThemeDefinition {
    id: ThemeId;
    label: string;
    description: string;
    vars: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  Region accent colours (shared across themes that want them)       */
/* ------------------------------------------------------------------ */

export const REGION_COLORS: Record<string, string> = {
    Kanto:  '#EF4444', // red
    Johto:  '#EAB308', // gold
    Hoenn:  '#06B6D4', // cyan/teal
    Sinnoh: '#3B82F6', // blue
    Unova:  '#8B5CF6', // purple
    Kalos:  '#EC4899', // pink
    Alola:  '#F97316', // orange
    Galar:  '#A855F7', // violet
    Hisui:  '#14B8A6', // teal
    Paldea: '#F43F5E', // rose
};

/* ------------------------------------------------------------------ */
/*  Theme definitions                                                  */
/* ------------------------------------------------------------------ */

const defaultTheme: ThemeDefinition = {
    id: 'default',
    label: 'Default',
    description: 'Clean dark interface',
    vars: {
        /* Backgrounds */
        '--pp-bg-base':       '#030712',   // gray-950
        '--pp-bg-surface':    '#0d1117',   // gray-900 ish
        '--pp-bg-elevated':   '#1f2937',   // gray-800
        '--pp-bg-input':      '#030712',   // gray-950
        '--pp-bg-header':     '#0d1117',   // gray-900

        /* Borders */
        '--pp-border':        '#1f2937',   // gray-800
        '--pp-border-subtle':  '#374151',  // gray-700
        '--pp-border-region': '#374151aa', // gray-700/70

        /* Text */
        '--pp-text-primary':   'rgba(255,255,255,0.87)',
        '--pp-text-secondary': '#9CA3AF',  // gray-400
        '--pp-text-muted':     '#6B7280',  // gray-500
        '--pp-text-region':    '#9CA3AF',  // gray-400

        /* Accents */
        '--pp-accent':         '#3B82F6',  // blue-600
        '--pp-accent-hover':   '#2563EB',  // blue-700
        '--pp-accent-glow':    'rgba(59,130,246,0.3)',

        /* Region card */
        '--pp-region-bg':        'rgba(13,17,23,0.7)',
        '--pp-region-header-bg': 'transparent',
        '--pp-region-accent':    'transparent',

        /* Slot states — unchanged */
        '--pp-slot-locked-bg':    'rgba(31,41,55,0.6)',
        '--pp-slot-locked-border':'rgba(55,65,81,0.3)',

        /* Guess input */
        '--pp-input-bg':       '#1f2937',
        '--pp-input-border':   '#4B5563',
        '--pp-input-focus':    '#22C55E',

        /* Nav / toolbar */
        '--pp-nav-bg':         '#0d1117',
        '--pp-nav-border':     '#1f2937',

        /* Logo */
        '--pp-logo-from':      '#4ADE80',  // green-400
        '--pp-logo-to':        '#10B981',  // emerald-500

        /* Sidebar */
        '--pp-sidebar-bg':     'rgba(13,17,23,0.95)',

        /* Modal */
        '--pp-modal-bg':       '#111827',  // gray-900
        '--pp-modal-border':   '#1f2937',

        /* Special */
        '--pp-splash-bg':      '#030712',
        '--pp-card-radius':    '0.75rem',
        '--pp-slot-radius':    '0.375rem',

        /* Region-specific accents (all transparent in default) */
        '--pp-region-kanto':   'transparent',
        '--pp-region-johto':   'transparent',
        '--pp-region-hoenn':   'transparent',
        '--pp-region-sinnoh':  'transparent',
        '--pp-region-unova':   'transparent',
        '--pp-region-kalos':   'transparent',
        '--pp-region-alola':   'transparent',
        '--pp-region-galar':   'transparent',
        '--pp-region-hisui':   'transparent',
        '--pp-region-paldea':  'transparent',
    },
};

const pokemonTheme: ThemeDefinition = {
    id: 'pokemon',
    label: 'Pokemon',
    description: 'Colourful & game-inspired',
    vars: {
        /* Backgrounds — deep dark RED/maroon base, not blue */
        '--pp-bg-base':       '#1a0a0e',
        '--pp-bg-surface':    '#241218',
        '--pp-bg-elevated':   '#3a1a22',
        '--pp-bg-input':      '#1e0c12',
        '--pp-bg-header':     '#1a0a0e',

        /* Borders — warm red-tinged, not gray */
        '--pp-border':        '#4a2030',
        '--pp-border-subtle':  '#5c2a3a',
        '--pp-border-region': '#5c2a3a88',

        /* Text — warm whites */
        '--pp-text-primary':   '#FFF5F5',
        '--pp-text-secondary': '#D4A0A0',
        '--pp-text-muted':     '#8B6060',
        '--pp-text-region':    '#FFE0E0',

        /* Accents — bright Pokemon red */
        '--pp-accent':         '#EF4444',
        '--pp-accent-hover':   '#DC2626',
        '--pp-accent-glow':    'rgba(239,68,68,0.3)',

        /* Region card — dark with red warmth */
        '--pp-region-bg':        'rgba(36,18,24,0.9)',
        '--pp-region-header-bg': 'transparent',
        '--pp-region-accent':    'currentColor',

        /* Slot states — warm-toned */
        '--pp-slot-locked-bg':    'rgba(58,26,34,0.5)',
        '--pp-slot-locked-border':'rgba(92,42,58,0.35)',

        /* Guess input — red palette */
        '--pp-input-bg':       '#2a1018',
        '--pp-input-border':   '#5c2a3a',
        '--pp-input-focus':    '#EF4444',

        /* Nav / toolbar */
        '--pp-nav-bg':         '#1a0a0e',
        '--pp-nav-border':     '#4a2030',

        /* Logo — Pokemon red-to-gold gradient */
        '--pp-logo-from':      '#FF4444',
        '--pp-logo-to':        '#FFD700',

        /* Sidebar — deep maroon */
        '--pp-sidebar-bg':     'rgba(26,10,14,0.98)',

        /* Modal — warm dark */
        '--pp-modal-bg':       '#241218',
        '--pp-modal-border':   '#4a2030',

        /* Special */
        '--pp-splash-bg':      '#1a0a0e',
        '--pp-card-radius':    '1rem',
        '--pp-slot-radius':    '0.5rem',

        /* Region-specific accents */
        '--pp-region-kanto':   '#EF444440',
        '--pp-region-johto':   '#EAB30840',
        '--pp-region-hoenn':   '#06B6D440',
        '--pp-region-sinnoh':  '#3B82F640',
        '--pp-region-unova':   '#8B5CF640',
        '--pp-region-kalos':   '#EC489940',
        '--pp-region-alola':   '#F9731640',
        '--pp-region-galar':   '#A855F740',
        '--pp-region-hisui':   '#14B8A640',
        '--pp-region-paldea':  '#F43F5E40',
    },
};

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export const THEMES: ThemeDefinition[] = [defaultTheme, pokemonTheme];

export function getTheme(id: ThemeId): ThemeDefinition {
    return THEMES.find(t => t.id === id) ?? defaultTheme;
}

export function applyTheme(id: ThemeId): void {
    const theme = getTheme(id);
    const root = document.documentElement;
    for (const [prop, value] of Object.entries(theme.vars)) {
        root.style.setProperty(prop, value);
    }
    root.dataset.theme = id;
}
