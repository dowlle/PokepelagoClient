import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const publicUrl = (name: string) => new URL(`../public/${name}`, import.meta.url);

function pngInfo(name: string) {
    const buf = readFileSync(publicUrl(name));
    return {
        buf,
        signature: buf.subarray(0, 8).toString('hex'),
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
        colorType: buf.readUInt8(25),
    };
}

describe('PWA assets', () => {
    it('links the manifest and apple touch icon from index.html under the base path', () => {
        const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
        expect(html).toContain('<link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png" />');
        expect(html).toContain('<link rel="manifest" href="%BASE_URL%manifest.webmanifest" />');
        expect(html).toContain('<meta name="theme-color" content="#030712" />');
    });

    it('describes the install as a standalone app with the site dark colours', () => {
        const manifest = JSON.parse(readFileSync(publicUrl('manifest.webmanifest'), 'utf8'));
        expect(manifest.name).toBe('Pokepelago');
        expect(manifest.short_name).toBe('Pokepelago');
        expect(manifest.display).toBe('standalone');
        expect(manifest.theme_color).toBe('#030712');
        expect(manifest.background_color).toBe('#030712');
        expect(manifest.start_url).toBe('.');
        expect(manifest.scope).toBe('.');
    });

    it('uses relative icon srcs so both deploy base paths resolve', () => {
        const manifest = JSON.parse(readFileSync(publicUrl('manifest.webmanifest'), 'utf8'));
        expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
        for (const icon of manifest.icons) {
            expect(icon.src.startsWith('/')).toBe(false);
            expect(icon.src).not.toMatch(/^[a-z]+:/i);
        }
        expect(manifest.icons.map((icon: { purpose: string }) => icon.purpose)).toContain('maskable');
        expect(manifest.icons.map((icon: { purpose: string }) => icon.purpose)).toContain('any');
    });

    it('ships real PNG icons at the declared sizes', () => {
        const expected: [string, number][] = [
            ['apple-touch-icon.png', 180],
            ['icon-192.png', 192],
            ['icon-512.png', 512],
            ['icon-maskable-512.png', 512],
        ];
        for (const [name, size] of expected) {
            const png = pngInfo(name);
            expect(png.signature).toBe('89504e470d0a1a0a');
            expect(png.width).toBe(size);
            expect(png.height).toBe(size);
            // 2 = truecolour, 6 = truecolour with alpha: a decoded raster, not a blank stub
            expect([2, 6]).toContain(png.colorType);
            expect(png.buf.length).toBeGreaterThan(1000);
        }
    });

    it('ships every icon the manifest references', () => {
        const manifest = JSON.parse(readFileSync(publicUrl('manifest.webmanifest'), 'utf8'));
        for (const icon of manifest.icons as { src: string; sizes: string }[]) {
            const info = pngInfo(icon.src);
            const [w, h] = icon.sizes.split('x').map(Number);
            expect(info.width).toBe(w);
            expect(info.height).toBe(h);
        }
    });
});
