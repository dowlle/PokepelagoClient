import { openDB, type IDBPDatabase } from 'idb';
import { parsePokemonIdFromFileName } from '../utils/pokemon';

const DB_NAME = 'pokepelago-sprites';
const STORE_NAME = 'sprites';

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                db.createObjectStore(STORE_NAME);
            },
        });
    }
    return dbPromise;
};

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export const saveSprite = async (key: string, blob: Blob) => {
    const db = await getDB();
    await db.put(STORE_NAME, blob, key);
};

export const getSprite = async (key: string): Promise<Blob | undefined> => {
    const db = await getDB();
    return await db.get(STORE_NAME, key);
};

export const clearAllSprites = async () => {
    const db = await getDB();
    await db.clear(STORE_NAME);
};

export const countSprites = async (): Promise<number> => {
    const db = await getDB();
    return await db.count(STORE_NAME);
};

export const generateSpriteKey = (id: number, options: { shiny?: boolean; animated?: boolean }) => {
    const parts: (string | number)[] = [id];
    if (options.shiny) parts.push('shiny');
    if (options.animated) parts.push('animated');
    return parts.join('_');
};

export const importFromFiles = async (files: FileList | File[], onProgress?: (count: number) => void) => {
    // Expected file names: 1.png, 1_shiny.png, 1.gif, 1_shiny.gif, etc.
    // Or folders: static/1.png, shiny/1.png, animated/1.gif, animated/shiny_1.gif
    // Or full PokeAPI raw repo structure paths.

    let importedCount = 0;

    for (const file of Array.from(files)) {
        const name = file.name;
        // e.g. "sprites-master/sprites/pokemon/1.png"
        const path = ((file as any).webkitRelativePath || name).replace(/\\/g, '/');

        // Ignore back sprites
        if (path.includes('/back/')) {
            continue;
        }

        let key = '';

        // Optimization for PokeAPI repo structure (huge 1.4GB folder)
        // Extract straight from the known PokeAPI paths
        const pokeApiStatic = path.match(/\/(?:sprites\/)?pokemon\/(\d+)\.png$/i);
        const pokeApiShiny = path.match(/\/(?:sprites\/)?pokemon\/shiny\/(\d+)\.png$/i);
        const pokeApiAnimated = path.match(/\/(?:sprites\/)?pokemon\/other\/showdown\/(\d+)\.gif$/i);
        const pokeApiAnimatedShiny = path.match(/\/(?:sprites\/)?pokemon\/other\/showdown\/shiny\/(\d+)\.gif$/i);

        if (pokeApiAnimatedShiny) {
            const id = parseInt(pokeApiAnimatedShiny[1]);
            if (id < 10000) key = generateSpriteKey(id, { shiny: true, animated: true });
        } else if (pokeApiAnimated) {
            const id = parseInt(pokeApiAnimated[1]);
            if (id < 10000) key = generateSpriteKey(id, { animated: true });
        } else if (pokeApiShiny) {
            const id = parseInt(pokeApiShiny[1]);
            if (id < 10000) key = generateSpriteKey(id, { shiny: true });
        } else if (pokeApiStatic) {
            const id = parseInt(pokeApiStatic[1]);
            if (id < 10000) key = generateSpriteKey(id, {});
        }
        // Backward compatibility for old script structures
        else if (path.includes('static/')) {
            const id = parsePokemonIdFromFileName(name);
            if (id !== null && id < 10000) key = generateSpriteKey(id, {});
        } else if (path.includes('shiny/')) {
            const id = parsePokemonIdFromFileName(name);
            if (id !== null && id < 10000) key = generateSpriteKey(id, { shiny: true });
        } else if (path.includes('animated/')) {
            if (name.startsWith('shiny_')) {
                const id = parsePokemonIdFromFileName(name.replace('shiny_', ''));
                if (id !== null && id < 10000) key = generateSpriteKey(id, { shiny: true, animated: true });
            } else {
                const id = parsePokemonIdFromFileName(name);
                if (id !== null && id < 10000) key = generateSpriteKey(id, { animated: true });
            }
        } else if (path.split('/').length <= 2) {
            // Flat folder import: webkitRelativePath is "foldername/001.png" (one slash).
            // Also handles bare file drag-drop with no path separator.
            const id = parsePokemonIdFromFileName(name);
            if (id !== null && id < 10000) {
                const lowerName = name.toLowerCase();
                const isShiny = lowerName.includes('shiny');
                const isAnimated = lowerName.endsWith('.gif') || lowerName.includes('animated');
                key = generateSpriteKey(id, { shiny: isShiny, animated: isAnimated });
            }
        }

        if (key) {
            await saveSprite(key, file);
            importedCount++;
            if (onProgress && importedCount % 100 === 0) {
                onProgress(importedCount);
            }
        }
    }

    return importedCount;
};
