import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { DumbbellEntry } from '../models/dumbbell-entry.model';

@Injectable({ providedIn: 'root' })
export class DumbbellsService {
  constructor(private readonly db: IndexedDbService) {}

  getAll(): Promise<DumbbellEntry[]> {
    return this.db.getAll<DumbbellEntry>(STORES.dumbbells);
  }

  add(entry: DumbbellEntry): Promise<void> {
    return this.db.add(STORES.dumbbells, entry);
  }

  update(entry: DumbbellEntry): Promise<void> {
    return this.db.put(STORES.dumbbells, entry);
  }

  delete(id: string): Promise<void> {
    return this.db.delete(STORES.dumbbells, id);
  }
}
