/**
 * Per-browser settings in localStorage (kf.theme, kf.locale, kf.warehouse, kf.scanMode, kf.sound, kf.sidebar). Every
 * read and write is guarded: private mode or blocked site data must not break a screen (Decisions 6).
 */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice lasts until the page reloads.
  }
}
