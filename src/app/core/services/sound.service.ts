import { Injectable } from '@angular/core';

// Plays the app's shared expired-timer/rest-reminder sound
// (public/sounds/Gong.mp3), used by both a Time-Based set's own countdown
// and the rest-timer popup between sets/exercises. Silently does nothing if
// audio playback isn't available (e.g. no user gesture yet in some
// browsers).
@Injectable({ providedIn: 'root' })
export class SoundService {
  private gong?: HTMLAudioElement;

  // Starts loading the gong ahead of time - a timer that must gong at an
  // exact moment (see SessionsComponent.startCountdown) calls this when it
  // starts, so the sound file isn't still being fetched when that moment
  // arrives.
  preloadGong(): void {
    try {
      this.gongElement();
    } catch {
      // Audio playback isn't available - nothing to warm up.
    }
  }

  playGong(): void {
    try {
      const gong = this.gongElement();
      gong.currentTime = 0;
      void gong.play().catch(() => {
        // Audio playback isn't available - fail silently rather than block the caller.
      });
    } catch {
      // Audio playback isn't available - fail silently rather than block the caller.
    }
  }

  private gongElement(): HTMLAudioElement {
    if (!this.gong) {
      this.gong = new Audio('/sounds/Gong.mp3');
      this.gong.preload = 'auto';
    }
    return this.gong;
  }
}
