import { GenerationItem, ReelRecord } from '../types/forge';
import { loadHistory, saveHistorySafely } from './imageChain';
import { loadReelHistory, saveReelHistorySafely } from './reelCompiler';

const DB_NAME = 'animereel_studio_db';
const DB_VERSION = 1;
const REELS_STORE = 'reels';
const IMAGES_STORE = 'images';

function openStudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REELS_STORE)) {
        db.createObjectStore(REELS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function getAllFromStore<T extends { createdAt: number }>(
  storeName: string
): Promise<T[]> {
  const db = await openStudioDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = Array.isArray(req.result) ? (req.result as T[]) : [];
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(items);
      };
      req.onerror = () => reject(req.error || new Error('IndexedDB read error'));
    });
  } finally {
    db.close();
  }
}

async function putRecordInStore<T>(storeName: string, record: T): Promise<void> {
  const db = await openStudioDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write error'));
    });
  } finally {
    db.close();
  }
}

async function deleteRecordFromStore(storeName: string, id: string): Promise<void> {
  const db = await openStudioDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB delete error'));
    });
  } finally {
    db.close();
  }
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openStudioDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB clear error'));
    });
  } finally {
    db.close();
  }
}

export async function loadReelsFromDb(): Promise<ReelRecord[]> {
  try {
    const dbReels = await getAllFromStore<ReelRecord>(REELS_STORE);
    if (dbReels.length > 0) return dbReels;

    const legacy = loadReelHistory();
    if (legacy.length > 0) {
      await Promise.all(legacy.map((r) => putRecordInStore(REELS_STORE, r)));
    }
    return legacy;
  } catch {
    return loadReelHistory();
  }
}

export async function saveReelToDb(record: ReelRecord): Promise<void> {
  try {
    await putRecordInStore(REELS_STORE, record);
  } catch {
    // Fallback: strip videoBlob for localStorage quota safety
    const { videoBlob: _blob, ...lightweight } = record;
    const prev = loadReelHistory().filter((r) => r.id !== record.id);
    saveReelHistorySafely([lightweight, ...prev]);
  }
}

export async function deleteReelFromDb(id: string): Promise<void> {
  try {
    await deleteRecordFromStore(REELS_STORE, id);
  } catch {
    // Ignore
  }
  const prev = loadReelHistory();
  saveReelHistorySafely(prev.filter((r) => r.id !== id));
}

export async function clearReelsDb(): Promise<void> {
  try {
    await clearStore(REELS_STORE);
  } catch {
    // Ignore
  }
  saveReelHistorySafely([]);
}

export async function loadImagesFromDb(): Promise<GenerationItem[]> {
  try {
    const dbImages = await getAllFromStore<GenerationItem>(IMAGES_STORE);
    if (dbImages.length > 0) return dbImages;

    const legacy = loadHistory();
    if (legacy.length > 0) {
      await Promise.all(legacy.map((item) => putRecordInStore(IMAGES_STORE, item)));
    }
    return legacy;
  } catch {
    return loadHistory();
  }
}

export async function saveImageToDb(item: GenerationItem): Promise<void> {
  try {
    await putRecordInStore(IMAGES_STORE, item);
  } catch {
    const prev = loadHistory().filter((x) => x.id !== item.id);
    saveHistorySafely([item, ...prev]);
  }
}

export async function deleteImageFromDb(id: string): Promise<void> {
  try {
    await deleteRecordFromStore(IMAGES_STORE, id);
  } catch {
    // Ignore
  }
  const prev = loadHistory();
  saveHistorySafely(prev.filter((x) => x.id !== id));
}

export async function clearImagesDb(): Promise<void> {
  try {
    await clearStore(IMAGES_STORE);
  } catch {
    // Ignore
  }
  saveHistorySafely([]);
}
