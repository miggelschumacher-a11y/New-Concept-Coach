import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { SessionsService } from '../core/services/sessions.service';
import { TrainingSession } from '../core/models/session.model';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatCardModule
  ],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss'
})
export class SessionsComponent implements OnInit {
  sessions: TrainingSession[] = [];
  date = new Date().toISOString().slice(0, 10);
  notes = '';

  constructor(private readonly sessionsService: SessionsService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.sessions = await this.sessionsService.getAll();
  }

  async addSession(): Promise<void> {
    if (!this.date) {
      return;
    }
    await this.sessionsService.add({ date: this.date, notes: this.notes.trim() });
    this.notes = '';
    await this.load();
  }

  async deleteSession(id: string): Promise<void> {
    await this.sessionsService.delete(id);
    await this.load();
  }
}
