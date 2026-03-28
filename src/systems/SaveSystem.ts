// Save System using IndexedDB for multiple save slots
import type { GamePhase } from '../App';
import type { DailyGuestRecord, DailySummary, JournalReward } from '../types/journal';

const DB_NAME = 'izakaya_saves';
const DB_VERSION = 1;
const STORE_NAME = 'saves';

export interface SaveData {
  phase: GamePhase;
  currentWeek: number;
  currentDay: number;
  currentGuestInDay: number;
  characterProgress: Record<string, number>;
  characterObservations?: Record<string, string[]>;
  discoveredFeatures: string[];
  unlockedRecipes: string[];
  inventory: string[];
  isSuccess: boolean;
  currentNodeId: string | null;
  // Observation state
  showObservation: boolean;
  observationPrompt: string;
  observationContinueNode: string | null;
  availableFeatureGroups: string[] | undefined;
  // Mixing state
  isMixing: boolean;
  mixedDrinkName: string | undefined;
  // Teaching/Mixing node IDs for re-derivation on load
  teachingNodeId: string | null;
  mixingNodeId: string | null;
  // Journal state
  currentGuestRewards?: JournalReward[];
  currentGuestDrinkLabel?: string;
  currentGuestChallenges?: string[];
  currentDayRecords?: DailyGuestRecord[];
  journalHistory?: DailySummary[];
  pendingDaySummary?: DailySummary | null;
  pendingGuestReflection?: {
    text: string;
    sameDay: boolean;
    nextWeek: number;
    nextDay: number;
    nextGuestInDay: number;
    daySummary: DailySummary | null;
    nextDayRecords: DailyGuestRecord[];
  } | null;
  currentGuestTranscript?: Array<{
    key: string;
    speaker: string;
    text: string;
  }>;
}

export interface SaveSlot {
  id: string;
  name: string;
  timestamp: number;
  data: SaveData;
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
        console.log('[SaveSystem] IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[SaveSystem] Created object store:', STORE_NAME);
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
        const saves = request.result as SaveSlot[];
        // Sort by timestamp descending (newest first)
        saves.sort((a, b) => b.timestamp - a.timestamp);
        resolve(saves);
      };

      request.onerror = () => {
        console.error('[SaveSystem] Failed to get all saves:', request.error);
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
        resolve(request.result as SaveSlot || null);
      };

      request.onerror = () => {
        console.error('[SaveSystem] Failed to get save:', id, request.error);
        reject(request.error);
      };
    });
  }

  async saveGame(id: string, name: string, data: SaveData): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const slot: SaveSlot = {
        id,
        name,
        timestamp: Date.now(),
        data,
      };

      const request = store.put(slot);

      request.onsuccess = () => {
        console.log('[SaveSystem] Saved game to slot:', id, name);
        resolve();
      };

      request.onerror = () => {
        console.error('[SaveSystem] Failed to save game:', id, request.error);
        reject(request.error);
      };
    });
  }

  async deleteSave(id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[SaveSystem] Deleted save slot:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('[SaveSystem] Failed to delete save:', id, request.error);
        reject(request.error);
      };
    });
  }

  async hasSave(id: string): Promise<boolean> {
    const save = await this.getSave(id);
    return save !== null;
  }
}

export const saveSystem = new SaveSystem();
