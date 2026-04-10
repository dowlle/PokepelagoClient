import React from 'react';
import { useGame } from '../context/GameContext';

/**
 * Pokepelago logo component.
 *
 * In the default theme: renders the existing gradient text.
 * In the pokemon theme: renders a bold, game-styled SVG logo with
 * outline, drop shadow, and a subtle pokeball accent.
 */
export const PokeLogo: React.FC<{
    size?: 'sm' | 'lg';
    onClick?: () => void;
}> = ({ size = 'sm', onClick }) => {
    const { uiSettings } = useGame();
    const isPokemonTheme = uiSettings.theme === 'pokemon';

    if (!isPokemonTheme) {
        // Default theme: gradient text (unchanged from original)
        return (
            <h1
                className={`font-black tracking-tight bg-clip-text text-transparent cursor-pointer hover:opacity-75 transition-opacity select-none ${
                    size === 'lg' ? 'text-6xl tracking-tighter mb-4' : 'text-xl whitespace-nowrap'
                }`}
                style={{ backgroundImage: `linear-gradient(to right, var(--pp-logo-from), var(--pp-logo-to))` }}
                onClick={onClick}
                title="Credits & Changelog"
            >
                Poképelago
            </h1>
        );
    }

    // Pokemon theme: game-styled logo
    const isLarge = size === 'lg';
    const w = isLarge ? 420 : 180;
    const h = isLarge ? 80 : 36;
    const fontSize = isLarge ? 52 : 23;

    return (
        <div
            className={`cursor-pointer hover:opacity-85 transition-opacity select-none ${isLarge ? 'mb-4' : ''}`}
            onClick={onClick}
            title="Credits & Changelog"
        >
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
                <defs>
                    {/* Main gradient: red -> gold */}
                    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FF4444" />
                        <stop offset="40%" stopColor="#FF6B35" />
                        <stop offset="100%" stopColor="#FFD700" />
                    </linearGradient>
                    {/* Inner shine */}
                    <linearGradient id="logo-shine" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
                        <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
                    </linearGradient>
                    {/* Drop shadow */}
                    <filter id="logo-shadow" x="-5%" y="-5%" width="110%" height="130%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FF4444" floodOpacity="0.2" />
                    </filter>
                </defs>

                {/* Main text — dark outline for depth */}
                <text
                    x={w / 2}
                    y={h * 0.72}
                    textAnchor="middle"
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight="900"
                    fontSize={fontSize}
                    letterSpacing="-0.02em"
                    stroke="#1a0505"
                    strokeWidth={isLarge ? 6 : 3}
                    strokeLinejoin="round"
                    fill="none"
                    filter="url(#logo-shadow)"
                >
                    Poképelago
                </text>

                {/* Main text — gradient fill */}
                <text
                    x={w / 2}
                    y={h * 0.72}
                    textAnchor="middle"
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight="900"
                    fontSize={fontSize}
                    letterSpacing="-0.02em"
                    fill="url(#logo-grad)"
                >
                    Poképelago
                </text>

                {/* Inner highlight overlay */}
                <text
                    x={w / 2}
                    y={h * 0.72}
                    textAnchor="middle"
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight="900"
                    fontSize={fontSize}
                    letterSpacing="-0.02em"
                    fill="url(#logo-shine)"
                >
                    Poképelago
                </text>

                {/* Tiny pokeball accent after the name */}
                <g transform={`translate(${w - (isLarge ? 24 : 12)}, ${isLarge ? 12 : 5})`} opacity="0.6">
                    <circle r={isLarge ? 8 : 4} fill="none" stroke="#FFD700" strokeWidth={isLarge ? 1.5 : 0.8} />
                    <line x1={isLarge ? -8 : -4} y1="0" x2={isLarge ? 8 : 4} y2="0" stroke="#FFD700" strokeWidth={isLarge ? 1 : 0.5} />
                    <circle r={isLarge ? 2.5 : 1.2} fill="#FFD700" />
                </g>
            </svg>
        </div>
    );
};
