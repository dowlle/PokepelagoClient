import React, { useState } from 'react';
import { WifiOff, BookOpen } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { ConnectionManager } from './ConnectionManager';
import type { GameProfile } from '../services/connectionManagerService';

interface StartGameOverlayProps {
    onDismiss: () => void;
}

export function StartGameOverlay({ onDismiss }: StartGameOverlayProps) {
    const { startGame, disconnect, connect, setConnectionInfo, setCurrentProfileId, setGameMode } = useGame();
    const [spriteLoaded, setSpriteLoaded] = useState(false);
    const [spriteFailed, setSpriteFailed] = useState(false);
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    const handleConnectProfile = async (profile: GameProfile) => {
        setCurrentProfileId(profile.id);
        setConnectionInfo({
            hostname: profile.hostname,
            port: profile.port,
            slotName: profile.slotName,
            password: profile.password || '',
        });
        setGameMode('archipelago');
        await connect({
            hostname: profile.hostname,
            port: profile.port,
            slotName: profile.slotName,
            password: profile.password,
        }, profile.id);
    };

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                onClick={onDismiss}
            >
                <div
                    className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Town Map sprite with star fallback */}
                    <div className="flex items-center justify-center mb-4 h-12">
                        {!spriteFailed && (
                            <img
                                src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/town-map.png"
                                alt="Town Map"
                                style={{ imageRendering: 'pixelated' }}
                                className={`w-12 h-12 object-contain transition-opacity duration-200 ${spriteLoaded ? 'opacity-100' : 'opacity-0'}`}
                                onLoad={() => setSpriteLoaded(true)}
                                onError={() => setSpriteFailed(true)}
                            />
                        )}
                        {spriteFailed && <span className="text-5xl">🌟</span>}
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">Ready to Begin?</h2>
                    <p className="text-gray-400 mb-6">
                        Professor Oak is ready to send you your starting items.
                        Press the button below to begin your adventure and send
                        your starting checks to the multiworld.
                    </p>
                    <button
                        onClick={startGame}
                        className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-lg"
                    >
                        Begin Your Adventure!
                    </button>

                    <div className="flex items-center gap-3 mt-4">
                        <button
                            onClick={() => setIsManagerOpen(true)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-gray-200 rounded-xl text-sm font-semibold transition-colors"
                        >
                            <BookOpen size={14} />
                            Manage Games
                        </button>
                        <button
                            onClick={disconnect}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 bg-gray-800 hover:bg-red-900/40 border border-gray-700 hover:border-red-800/40 text-gray-400 hover:text-red-300 rounded-xl text-sm font-semibold transition-colors"
                        >
                            <WifiOff size={14} />
                            Disconnect
                        </button>
                    </div>
                </div>
            </div>

            <ConnectionManager
                isOpen={isManagerOpen}
                onClose={() => setIsManagerOpen(false)}
                onConnect={handleConnectProfile}
            />
        </>
    );
}
