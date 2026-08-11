import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'pokepelago-audio';
const STORE_NAME = 'sounds';

export type CustomSoundKind = 'guessable' | 'progressive';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbPromise: Promise<IDBPDatabase<any>> | null = null;

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

export const customSoundMarker = (revision = Date.now()): string => `indexeddb:${revision}`;

export const isCustomSoundMarker = (source: string | null | undefined): boolean =>
    Boolean(source?.startsWith('indexeddb:'));

export const saveCustomSound = async (kind: CustomSoundKind, blob: Blob): Promise<void> => {
    const db = await getDB();
    await db.put(STORE_NAME, blob, kind);
};

export const getCustomSound = async (kind: CustomSoundKind): Promise<Blob | undefined> => {
    const db = await getDB();
    return db.get(STORE_NAME, kind);
};

export const clearCustomSound = async (kind: CustomSoundKind): Promise<void> => {
    const db = await getDB();
    await db.delete(STORE_NAME, kind);
};
