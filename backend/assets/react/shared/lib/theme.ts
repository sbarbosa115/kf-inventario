import {useSyncExternalStore} from 'react';
import {readSetting, writeSetting} from './storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'kf.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();
let watching = false;

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function themePreference(): ThemePreference {
  const stored = readSetting(THEME_KEY);
  return isPreference(stored) ? stored : 'system';
}

function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light';
}

export function resolveTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? systemTheme() : preference;
}

/** Puts the theme on <html data-theme>, as the inline script of spa.html.twig did before the first paint. */
export function applyTheme(): void {
  document.documentElement.dataset.theme = resolveTheme(themePreference());
  listeners.forEach((listener) => listener());
}

/** Starts following the system's light/dark switch while the preference is "system". Called once by the app. */
export function watchSystemTheme(): void {
  if (watching || typeof window.matchMedia !== 'function') return;
  watching = true;
  window.matchMedia(DARK_QUERY).addEventListener?.('change', () => {
    if (themePreference() === 'system') applyTheme();
  });
}

export function setThemePreference(preference: ThemePreference): void {
  writeSetting(THEME_KEY, preference);
  applyTheme();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The chosen theme (light, dark or system) and how to change it; remembered per browser. */
export function useTheme(): [ThemePreference, (p: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribe, themePreference);
  return [preference, setThemePreference];
}
