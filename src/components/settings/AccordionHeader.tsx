import React from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionHeaderProps {
    sectionKey: string;
    icon: React.ReactNode;
    label: string;
    badge?: React.ReactNode;
    isEmbedded?: boolean;
    openSections: Record<string, boolean>;
    toggleSection: (key: string) => void;
}

export const AccordionHeader: React.FC<AccordionHeaderProps> = ({ sectionKey, icon, label, badge, isEmbedded, openSections, toggleSection }) => (
    <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 hover:bg-gray-800/60 transition-colors"
    >
        <h3 className={`font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 ${isEmbedded ? 'text-[10px]' : 'text-xs'}`}>
            {icon}
            {label}
            {badge}
        </h3>
        <ChevronDown
            size={14}
            className={`text-gray-600 transition-transform duration-200 ${openSections[sectionKey] ? 'rotate-180' : ''}`}
        />
    </button>
);
