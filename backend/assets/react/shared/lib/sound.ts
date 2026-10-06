import {useSyncExternalStore} from 'react';
import {readSetting, writeSetting} from './storage';

export const SOUND_KEY = 'kf.sound';
const listeners = new Set<() => void>();
let context: AudioContext | null = null;

export function soundOn(): boolean {
  return readSetting(SOUND_KEY) !== 'off';
}

export function setSoundOn(on: boolean): void {
  writeSetting(SOUND_KEY, on ? 'on' : 'off');
  listeners.forEach((listener) => listener());
}

/** A short 70 ms tone confirming a scan, unless the sound is off. Silent where the browser has no Web Audio. */
export function beep(): void {
  if (!soundOn()) return;
  const Audio =
    window.AudioContext ??
    (window as unknown as {webkitAudioContext?: typeof AudioContext})
      .webkitAudioContext;
  if (!Audio) return;
  try {
    context ??= new Audio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 1320;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.07);
  } catch {
    // No sound is better than a broken scan.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The scan sound's on/off switch, remembered per browser (kf.sound). */
export function useSound(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribe, soundOn), setSoundOn];
}
