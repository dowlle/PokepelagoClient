import React, { useEffect, useRef, useState } from 'react';
import { fetchAnimData, padPmdId } from '../services/pmdSpriteService';

interface PmdSpriteCanvasProps {
    id: number;
    baseUrl: string;
    anim: 'Idle' | 'Attack';
    onAnimComplete?: () => void;
    onError?: () => void;
    filterClass?: string;
    size: number;
    /**
     * When set, scale the sprite so that this many pixels of frame space maps
     * to `size` pixels on screen — instead of fitting the frame to the canvas.
     * Use the idle frameWidth here so that the attack animation renders at the
     * same character size even though its frames are larger (and can overflow).
     */
    referenceFrameSize?: number;
    /** Called once after frame data loads, with the frame's shorter dimension. */
    onFrameSize?: (sz: number) => void;
}

const TICK_MS = 1000 / 60;

/**
 * Canvas-based animated PMD sprite.
 * Renders a sprite sheet from SpriteCollab, animating row 0 (south-facing).
 * - Idle: loops forever
 * - Attack: plays once, then calls onAnimComplete()
 */
export const PmdSpriteCanvas: React.FC<PmdSpriteCanvasProps> = ({
    id,
    baseUrl,
    anim,
    onAnimComplete,
    onError,
    filterClass = '',
    size,
    referenceFrameSize,
    onFrameSize,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const paddedId = padPmdId(id);
        const animDataUrl = `${baseUrl}/${paddedId}/AnimData.xml`;
        const candidates = anim === 'Attack' ? ['Attack', 'Strike', 'Walk'] : ['Idle', 'Walk'];

        const run = async () => {
            // 1. Try each candidate animation until one loads successfully
            let frameData = null;
            let img: HTMLImageElement | null = null;

            for (const candidate of candidates) {
                const candidateData = await fetchAnimData(animDataUrl, candidate);
                if (!active) return;
                if (!candidateData) continue;

                const candidateImg = new Image();
                candidateImg.crossOrigin = 'anonymous';
                candidateImg.src = `${baseUrl}/${paddedId}/${candidate}-Anim.png`;

                const loaded = await new Promise<boolean>(resolve => {
                    candidateImg.onload = () => resolve(true);
                    candidateImg.onerror = () => resolve(false);
                });
                if (!active) return;
                if (!loaded) continue;

                frameData = candidateData;
                img = candidateImg;
                break;
            }

            if (!frameData || !img) {
                onError?.();
                return;
            }
            const loadedImg = img;

            const { frameWidth, frameHeight, durations } = frameData;

            // Report idle frame size so caller can use it as a reference for attack scaling
            onFrameSize?.(Math.min(frameWidth, frameHeight));

            // Scale: if a reference is provided (attack case), maintain the same
            // character size as idle even though attack frames are larger.
            // Otherwise fit the frame within `size` (idle case).
            const scale = referenceFrameSize
                ? size / referenceFrameSize
                : Math.min(size / frameWidth, size / frameHeight);

            const canvasW = Math.ceil(frameWidth * scale);
            const canvasH = Math.ceil(frameHeight * scale);

            // Resize the canvas element directly so it exactly fits the scaled frame.
            // This avoids centering math and lets the parent center the larger canvas.
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = canvasW;
            canvas.height = canvasH;
            canvas.style.width = `${canvasW}px`;
            canvas.style.height = `${canvasH}px`;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.imageSmoothingEnabled = false;

            const totalFrames = durations.length;
            let frameIndex = 0;
            let tickAccum = 0;
            let lastTime = performance.now();

            setReady(true);

            const drawFrame = (fi: number) => {
                ctx.clearRect(0, 0, canvasW, canvasH);
                ctx.drawImage(
                    loadedImg,
                    fi * frameWidth,   // source x (column = frame index)
                    0,                  // source y (row 0 = south/front-facing)
                    frameWidth,
                    frameHeight,
                    0, 0,
                    canvasW, canvasH,
                );
            };

            drawFrame(0);

            intervalId = setInterval(() => {
                if (!active) return;
                const now = performance.now();
                const elapsed = now - lastTime;
                lastTime = now;
                tickAccum += elapsed;

                const frameDurationMs = (durations[frameIndex] ?? 4) * TICK_MS;
                if (tickAccum >= frameDurationMs) {
                    tickAccum -= frameDurationMs;
                    frameIndex++;

                    if (frameIndex >= totalFrames) {
                        if (anim === 'Attack') {
                            // Play once → done
                            if (intervalId !== null) clearInterval(intervalId);
                            intervalId = null;
                            if (active) onAnimComplete?.();
                            return;
                        }
                        frameIndex = 0; // Idle loops
                    }
                    drawFrame(frameIndex);
                }
            }, 16); // ~60 fps tick
        };

        run();

        return () => {
            active = false;
            if (intervalId !== null) clearInterval(intervalId);
        };
    // Re-run when anim type changes (Idle ↔ Attack) or the Pokemon/URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, baseUrl, anim, referenceFrameSize]);

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className={`z-10 transition-all duration-300 ${ready ? 'opacity-100' : 'opacity-0'} ${filterClass}`}
            style={{ imageRendering: 'pixelated' }}
        />
    );
};
