import guessableSoundUrl from '../assets/Guessable.mp3';
import progressiveItemSoundUrl from '../assets/Obtained Item.mp3';

const DEFAULT_GUESSABLE_SOUND_URL = guessableSoundUrl;
const DEFAULT_PROGRESSIVE_ITEM_SOUND_URL = progressiveItemSoundUrl;

export const DEFAULT_AUDIO_NOTIFICATION_SETTINGS = {
  playGuessableSound: false,
  playProgressiveItemSound: false,
} as const;

export const AUDIO_NOTIFICATION_COOLDOWN_MS = 3000;

export function shouldPlaySoundAfterCooldown(lastPlayedAt: number | null | undefined, now: number): boolean {
  if (lastPlayedAt == null) return true;
  return now - lastPlayedAt >= AUDIO_NOTIFICATION_COOLDOWN_MS;
}

export function createDefaultSoundDataUrl(): string {
  return DEFAULT_GUESSABLE_SOUND_URL;
}

export function getGuessableSoundSourceOrDefault(source: string | null | undefined): string {
  return source && source.trim() ? source : DEFAULT_GUESSABLE_SOUND_URL;
}

export function getProgressiveItemSoundSourceOrDefault(source: string | null | undefined): string {
  return source && source.trim() ? source : DEFAULT_PROGRESSIVE_ITEM_SOUND_URL;
}
