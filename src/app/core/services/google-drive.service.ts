import { Injectable } from '@angular/core';

declare const google: any;

const CLIENT_ID = '378514290266-hq6di64hljgis5vslahs49v3ukkl3r2c.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  private accessToken: string | null = null;

  private ensureGisLoaded(): Promise<void> {
    if (typeof google !== 'undefined' && google.accounts?.oauth2) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')));
        return;
      }
      const script = document.createElement('script');
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
      document.head.appendChild(script);
    });
  }

  // Called directly from the click handler, before any other async work
  // (e.g. reading IndexedDB), so the popup this triggers is still tied to
  // the user gesture and doesn't get blocked by the browser.
  async requestAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }
    await this.ensureGisLoaded();
    return new Promise<string>((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (response: { access_token?: string; error?: string }) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error ?? 'No access token received.'));
            return;
          }
          this.accessToken = response.access_token;
          resolve(response.access_token);
        },
        error_callback: (error: { message?: string }) => {
          reject(new Error(error.message ?? 'Google sign-in was cancelled or failed.'));
        }
      });
      tokenClient.requestAccessToken();
    });
  }

  private async findBackupFileId(token: string, fileName: string): Promise<string | null> {
    const escapedName = fileName.replace(/'/g, "\\'");
    const params = new URLSearchParams({
      q: `name='${escapedName}' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id,name)'
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error(`Google Drive file search failed (${response.status}).`);
    }
    const result = (await response.json()) as { files?: { id: string }[] };
    return result.files?.[0]?.id ?? null;
  }

  async uploadBackup(token: string, json: string, fileName: string): Promise<void> {
    const normalizedName = fileName.toLowerCase().endsWith('.json') ? fileName : `${fileName}.json`;
    try {
      const fileId = await this.findBackupFileId(token, normalizedName);
      const boundary = 'trainings_app_backup_boundary';
      const metadata = { name: normalizedName, mimeType: 'application/json' };
      const body =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        `${json}\r\n` +
        `--${boundary}--`;

      const url = fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const response = await fetch(url, {
        method: fileId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      });

      if (!response.ok) {
        throw new Error(`Google Drive upload failed (${response.status}).`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        this.accessToken = null;
      }
      throw error;
    }
  }
}
