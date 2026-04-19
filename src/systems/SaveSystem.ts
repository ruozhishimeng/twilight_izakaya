import {
  PERSISTED_GAME_SNAPSHOT_VERSION,
  type PersistedGameSnapshot,
} from '../state/gameState';
import { normalizePersistedSnapshotData } from '../state/gamePersistence';

const DB_NAME = 'izakaya_saves';
const DB_VERSION = 1;
const STORE_NAME = 'saves';

export interface SaveSlot {
  id: string;
  name: string;
  timestamp: number;
  data: PersistedGameSnapshot;
}

class SaveSystem {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[SaveSystem] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  async getAllSaves(): Promise<SaveSlot[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const saves = (request.result as Array<Omit<SaveSlot, 'data'> & { data: unknown }>)
          .map(slot => ({
            ...slot,
            data: normalizePersistedSnapshotData(slot.data),
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
        resolve(saves);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getSave(id: string): Promise<SaveSlot | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const raw = request.result as (Omit<SaveSlot, 'data'> & { data: unknown }) | undefined;
        resolve(raw ? { ...raw, data: normalizePersistedSnapshotData(raw.data) } : null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async saveGame(id: string, name: string, data: PersistedGameSnapshot): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const slot: SaveSlot = {
        id,
        name,
        timestamp: Date.now(),
        data: {
          ...data,
          version: PERSISTED_GAME_SNAPSHOT_VERSION,
        },
      };

      const request = store.put(slot);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSave(id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async hasSave(id: string): Promise<boolean> {
    const save = await this.getSave(id);
    return save !== null;
  }
}

export const saveSystem = new SaveSystem();
