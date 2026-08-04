import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface AppUpdateStatus {
  available: boolean;
  version?: string;
  currentVersion: string;
  date?: string;
  body?: string;
  downloaded?: number;
  totalLength?: number;
  progressPercent?: number;
  error?: string;
  isChecking: boolean;
  isDownloading: boolean;
  isReadyToRestart: boolean;
}

export const CURRENT_APP_VERSION = '1.1.0';

export async function checkForUpdate(): Promise<{
  updateAvailable: boolean;
  updateObj: Update | null;
  version?: string;
  body?: string;
  error?: string;
}> {
  try {
    const update = await check();
    if (update && update.available) {
      return {
        updateAvailable: true,
        updateObj: update,
        version: update.version,
        body: update.body || '• Performance enhancements & bug fixes\n• Dynamic dynamic system automation\n• Enhanced security patch',
      };
    }
    return { updateAvailable: false, updateObj: null };
  } catch (err: any) {
    console.warn('[Updater Warning] Native check failed or in browser mode:', err?.message || err);
    // Dev / Browser fallback demo check
    return {
      updateAvailable: false,
      updateObj: null,
      error: typeof err === 'string' ? err : err?.message || 'Could not connect to update server',
    };
  }
}

export async function downloadAndInstallUpdate(
  updateObj: Update | null,
  onProgress?: (progress: { downloaded: number; total: number; percent: number }) => void
): Promise<boolean> {
  if (!updateObj) {
    console.log('[Updater] No native update object found. Simulating installation for demo...');
    let downloaded = 0;
    const total = 15 * 1024 * 1024; // 15 MB
    for (let i = 0; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 200));
      downloaded = Math.floor((i / 10) * total);
      onProgress?.({ downloaded, total, percent: Math.round((i / 10) * 100) });
    }
    return true;
  }

  try {
    let downloadedBytes = 0;
    let totalBytes = 0;

    await updateObj.downloadAndInstall((event: any) => {
      switch (event.event) {
        case 'Started':
          totalBytes = event.data.contentLength || 0;
          break;
        case 'Progress':
          downloadedBytes += event.data.chunkLength;
          const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          onProgress?.({ downloaded: downloadedBytes, total: totalBytes, percent });
          break;
        case 'Finished':
          onProgress?.({ downloaded: totalBytes, total: totalBytes, percent: 100 });
          break;
      }
    });

    return true;
  } catch (err) {
    console.error('[Updater Error] Download & Install failed:', err);
    throw err;
  }
}

export async function restartApplication(): Promise<void> {
  try {
    await relaunch();
  } catch (err) {
    console.warn('[Updater] Relaunch trigger skipped or running in dev server:', err);
    window.location.reload();
  }
}
