// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AnimFrameData } from '../services/pmdSpriteService';

const { fetchAnimDataMock } = vi.hoisted(() => ({
    fetchAnimDataMock: vi.fn(),
}));

vi.mock('../services/pmdSpriteService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/pmdSpriteService')>();
    return { ...actual, fetchAnimData: fetchAnimDataMock };
});

import { PmdSpriteCanvas } from './PmdSpriteCanvas';

const FRAME_DATA: AnimFrameData = { frameWidth: 32, frameHeight: 32, durations: [4, 4] };

// Image is never actually fetched in jsdom: fire onload on the next microtask
// so the component's `await new Promise(...)` resolves with the mock "image".
class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin = '';
    _src = '';
    set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
    }
    get src() {
        return this._src;
    }
}

class MockIntersectionObserver {
    static instances: MockIntersectionObserver[] = [];
    readonly callback: IntersectionObserverCallback;
    readonly targets: Element[] = [];
    connected = false;

    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        MockIntersectionObserver.instances.push(this);
    }

    observe(el: Element) {
        this.targets.push(el);
        this.connected = true;
    }

    unobserve() {}

    disconnect() {
        this.connected = false;
    }

    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }

    emit(isIntersecting: boolean) {
        const entry = {
            isIntersecting,
            target: this.targets[0] ?? document.body,
        } as unknown as IntersectionObserverEntry;
        this.callback([entry], this as unknown as IntersectionObserver);
    }
}

describe('PmdSpriteCanvas offscreen pause (PERF-11)', () => {
    let container: HTMLDivElement;
    let root: Root | null;
    let drawImage: ReturnType<typeof vi.fn>;
    let setIntervalSpy: ReturnType<typeof vi.spyOn>;
    let clearIntervalSpy: ReturnType<typeof vi.spyOn>;

    function render() {
        act(() => {
            root?.render(createElement(PmdSpriteCanvas, { id: 25, baseUrl: 'https://example.test/sprite', anim: 'Idle', size: 64 }));
        });
    }

    function unmountRoot() {
        if (!root) return;
        const current = root;
        root = null;
        act(() => {
            current.unmount();
        });
    }

    function observer() {
        const instance = MockIntersectionObserver.instances.at(-1);
        if (!instance) throw new Error('no IntersectionObserver instance');
        return instance;
    }

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        MockIntersectionObserver.instances.length = 0;
        fetchAnimDataMock.mockReset();
        fetchAnimDataMock.mockResolvedValue(FRAME_DATA);

        drawImage = vi.fn();
        const fakeCtx = {
            imageSmoothingEnabled: true,
            clearRect: vi.fn(),
            drawImage,
        };
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
            () => fakeCtx as unknown as CanvasRenderingContext2D,
        );

        setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
        clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

        vi.stubGlobal('Image', FakeImage);
        vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        unmountRoot();
        container.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('pauses the loop when the canvas leaves the viewport and resumes on return', async () => {
        await act(async () => {
            render();
        });

        // In viewport on mount (hook default): the loop should be running.
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
            observer().emit(false);
        });
        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
            observer().emit(true);
        });
        expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    });

    it('paints the first frame when mounted offscreen without starting the loop', async () => {
        let resolveAnim: ((value: AnimFrameData | null) => void) | null = null;
        fetchAnimDataMock.mockImplementation(
            () => new Promise<AnimFrameData | null>((resolve) => { resolveAnim = resolve; }),
        );

        await act(async () => {
            render();
        });

        // Report offscreen before the frame data finishes loading.
        await act(async () => {
            observer().emit(false);
        });

        await act(async () => {
            resolveAnim?.(FRAME_DATA);
        });

        // First frame is painted even though the canvas is offscreen...
        expect(drawImage).toHaveBeenCalledTimes(1);
        expect(drawImage.mock.calls[0][1]).toBe(0); // source x of frame 0
        // ...but the animation loop never starts.
        expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('disconnects the observer on unmount', async () => {
        await act(async () => {
            render();
        });
        const instance = observer();
        expect(instance.connected).toBe(true);

        unmountRoot();
        expect(instance.connected).toBe(false);
    });
});
