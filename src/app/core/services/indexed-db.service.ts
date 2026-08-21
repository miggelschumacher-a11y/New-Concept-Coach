import { Injectable } from '@angular/core';

const DB_NAME = 'trainings-app-db';
const DB_VERSION = 1;

export const STORES = {
  exercises: 'exercises',
  trainingPlans: 'trainingPlans',
  sessions: 'sessions'
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.openDatabase();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const storeName of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getStore(storeName: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise;
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    return toPromise(store.getAll() as IDBRequest<T[]>);
  }

  async get<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    const store = await this.getStore(storeName, 'readonly');
    return toPromise(store.get(id) as IDBRequest<T | undefined>);
  }

  async add<T>(storeName: StoreName, item: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.add(item));
  }

  async put<T>(storeName: StoreName, item: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.put(item));
  }

  async delete(storeName: StoreName, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.delete(id));
  }
}
