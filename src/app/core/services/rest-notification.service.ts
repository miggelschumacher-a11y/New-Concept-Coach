import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TranslationService } from './translation.service';

// The "gong" notification channel (Android 8+/API 26+ ignores a
// notification's own `sound` field entirely and only honors the sound
// configured on its channel - see createChannel below).
// Bumped from 'rest-gong' - Android treats a channel's sound/importance as
// immutable once created, so a device that already has the old channel id
// registered (e.g. from an earlier debug build installed before gong.mp3
// existed, or before this config was correct) would silently keep ignoring
// every future createChannel call with the same id, playing no sound at all
// with no error anywhere. A new id forces every device onto a fresh channel
// with the current settings; do this again in the future if the sound ever
// needs to change.
const CHANNEL_ID = 'rest-gong-v2';
// Must exist as android/app/src/main/res/raw/gong.mp3 - Android's channel/
// notification `sound` fields take a bare filename resolved against that
// folder, iOS resolves the same name against the app bundle. iOS only reads
// the per-notification field below (channels are an Android concept), and
// only supports it when the file is actually bundled into the Xcode project
// (Copy Bundle Resources) - not yet done, so iOS currently falls back to the
// system default notification sound instead of the app's own gong.
const SOUND_FILE = 'gong.mp3';

// Schedules the rest-timer's reminder as a native OS notification instead of
// relying purely on RestTimerDialogComponent's own in-page JS timer +
// <audio> element. A WebView's JS timers can be throttled or suspended by
// the OS the moment the screen dims/locks or the app loses focus - silently
// delaying the reminder by anywhere from a few seconds to several minutes,
// or missing it entirely, exactly when the user isn't looking at the screen
// (the whole point of a rest timer). A scheduled native notification is
// handled by the OS itself and fires at the correct wall-clock time
// regardless of the WebView's own state.
//
// No-op everywhere outside a native shell (isAvailable false in the
// browser) - RestTimerDialogComponent's own JS-timer gong remains the only
// mechanism there, and stays the ONLY mechanism used even when this service
// is unavailable, so nothing regresses for anyone testing in a browser.
@Injectable({ providedIn: 'root' })
export class RestNotificationService {
  private channelCreated = false;
  private permissionDenied = false;
  private nextId = 1;

  constructor(private readonly translationService: TranslationService) {}

  get isAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  private async ensureChannel(): Promise<void> {
    if (this.channelCreated || Capacitor.getPlatform() !== 'android') {
      return;
    }
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: this.translationService.translate('sessions.restNotificationTitle'),
      sound: SOUND_FILE,
      importance: 5,
      visibility: 1
    });
    this.channelCreated = true;
  }

  private async ensurePermission(): Promise<boolean> {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') {
      return true;
    }
    if (this.permissionDenied) {
      // Already asked once this run and it wasn't granted - don't re-prompt
      // on every single set.
      return false;
    }
    const result = await LocalNotifications.requestPermissions();
    this.permissionDenied = result.display !== 'granted';
    return !this.permissionDenied;
  }

  // Schedules one native reminder per given delay (seconds from now,
  // matching RestTimerDialogData's own threshold semantics), returning the
  // ids actually scheduled - empty when unavailable or permission was
  // refused - so the caller can cancel any still-pending ones the moment the
  // rest timer is dismissed.
  async scheduleGongs(delaysSeconds: number[]): Promise<number[]> {
    if (!this.isAvailable || !(await this.ensurePermission())) {
      return [];
    }
    await this.ensureChannel();
    const title = this.translationService.translate('sessions.restNotificationTitle');
    const body = this.translationService.translate('sessions.restNotificationBody');
    const now = Date.now();
    const notifications = delaysSeconds.map((delaySeconds) => ({
      id: this.nextId++,
      title,
      body,
      channelId: CHANNEL_ID,
      sound: SOUND_FILE,
      schedule: { at: new Date(now + delaySeconds * 1000), allowWhileIdle: true }
    }));
    await LocalNotifications.schedule({ notifications });
    return notifications.map((notification) => notification.id);
  }

  async cancel(ids: number[]): Promise<void> {
    if (!this.isAvailable || ids.length === 0) {
      return;
    }
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  }
}
