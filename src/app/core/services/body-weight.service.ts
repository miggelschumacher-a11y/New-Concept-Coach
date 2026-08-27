import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { BodyWeightEntry } from '../models/body-weight-entry.model';

@Injectable({ providedIn: 'root' })
export class BodyWeightService {
  constructor(private readonly db: IndexedDbService) {}

  getAll(): Promise<BodyWeightEntry[]> {
    return this.db.getAll<BodyWeightEntry>(STORES.bodyWeightEntries);
  }

  add(entry: BodyWeightEntry): Promise<void> {
    return this.db.add(STORES.bodyWeightEntries, entry);
  }

  delete(id: string): Promise<void> {
    return this.db.delete(STORES.bodyWeightEntries, id);
  }
}
