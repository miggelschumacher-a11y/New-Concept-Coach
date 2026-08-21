import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { TrainingSession } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionsService {
  constructor(private readonly db: IndexedDbService) {}

  getAll(): Promise<TrainingSession[]> {
    return this.db.getAll<TrainingSession>(STORES.sessions);
  }

  add(session: Omit<TrainingSession, 'id'>): Promise<TrainingSession> {
    const newSession: TrainingSession = { ...session, id: crypto.randomUUID() };
    return this.db.add(STORES.sessions, newSession).then(() => newSession);
  }

  update(session: TrainingSession): Promise<void> {
    return this.db.put(STORES.sessions, session);
  }

  delete(id: string): Promise<void> {
    return this.db.delete(STORES.sessions, id);
  }
}
