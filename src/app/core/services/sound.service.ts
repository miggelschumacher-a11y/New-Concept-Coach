import { Injectable } from '@angular/core';

// Plays the app's shared expired-timer/rest-reminder sound
// (public/sounds/Gong.mp3), used by both a Time-Based set's own countdown
// and the rest-timer popup between sets/exercises. Silently does nothing if
// audio playback isn't available (e.g. no user gesture yet in some
// browsers).
@Injectable({ providedIn: 'root' })
export class SoundService {
  playGong(): void {
    try {
      void new Audio('/sounds/Gong.mp3').play().catch(() => {
        // Audio playback isn't available - fail silently rather than block the caller.
      });
    } catch {
      // Audio playback isn't available - fail silently rather than block the caller.
    }
  }
}
