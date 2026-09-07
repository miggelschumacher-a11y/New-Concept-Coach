import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { PlateEntry } from '../models/plate-entry.model';

@Injectable({ providedIn: 'root' })
export class PlatesService {
  constructor(private readonly db: IndexedDbService) {}

  getAll(): Promise<PlateEntry[]> {
    return this.db.getAll<PlateEntry>(STORES.plates);
  }

  add(entry: PlateEntry): Promise<void> {
    return this.db.add(STORES.plates, entry);
  }

  update(entry: PlateEntry): Promise<void> {
    return this.db.put(STORES.plates, entry);
  }

  delete(id: string): Promise<void> {
    return this.db.delete(STORES.plates, id);
  }
}
