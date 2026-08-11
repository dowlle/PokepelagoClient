import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_NOTIFICATION_SETTINGS, getGuessableSoundSourceOrDefault, getProgressiveItemSoundSourceOrDefault, shouldPlaySoundAfterCooldown } from './audio';

describe('audio defaults', () => {
  it('keeps notification sounds opt-in by default', () => {
    expect(DEFAULT_AUDIO_NOTIFICATION_SETTINGS.playGuessableSound).toBe(false);
    expect(DEFAULT_AUDIO_NOTIFICATION_SETTINGS.playProgressiveItemSound).toBe(false);
  });

  it('uses the bundled guessable sound when no custom source is set', () => {
    expect(getGuessableSoundSourceOrDefault('')).toContain('Guessable');
  });

  it('uses the bundled progressive-item sound when no custom source is set', () => {
    expect(getProgressiveItemSoundSourceOrDefault('')).toContain('Obtained');
  });

  it('prevents repeat sounds until the cooldown window expires', () => {
    expect(shouldPlaySoundAfterCooldown(null, 0)).toBe(true);
    expect(shouldPlaySoundAfterCooldown(0, 2500)).toBe(false);
    expect(shouldPlaySoundAfterCooldown(0, 3000)).toBe(true);
    expect(shouldPlaySoundAfterCooldown(0, 4000)).toBe(true);
  });
});
