import { describe, it, expect } from 'vitest';
import { ARCHIPELAGO_STEPS, STANDALONE_STEPS } from './useTour';

// P0-6 onboarding: guard the tour step tables. STANDALONE_STEPS resolves its
// entries from ARCHIPELAGO_STEPS by id, so a bad id or a broken reference would
// surface as an undefined field here (the module also throws at load on a bad id).

describe('tour steps', () => {
  it('every step has a title, selector, and description', () => {
    for (const step of [...ARCHIPELAGO_STEPS, ...STANDALONE_STEPS]) {
      expect(step.title, `step ${step.id} title`).toBeTruthy();
      expect(step.selector, `step ${step.id} selector`).toBeTruthy();
      expect(step.description, `step ${step.id} description`).toBeTruthy();
    }
  });

  it('has unique step ids within each mode', () => {
    const arch = ARCHIPELAGO_STEPS.map(s => s.id);
    const standalone = STANDALONE_STEPS.map(s => s.id);
    expect(new Set(arch).size).toBe(arch.length);
    expect(new Set(standalone).size).toBe(standalone.length);
  });

  it('includes the Guessable/Guessed dex-filter step in both modes', () => {
    expect(ARCHIPELAGO_STEPS.some(s => s.id === 'dex-filter')).toBe(true);
    expect(STANDALONE_STEPS.some(s => s.id === 'dex-filter')).toBe(true);
  });

  it('language step explains that guesses are matched in the selected language', () => {
    const lang = ARCHIPELAGO_STEPS.find(s => s.id === 'lang-selector');
    expect(lang).toBeDefined();
    expect(lang!.description.toLowerCase()).toContain('language');
    expect(lang!.description.toLowerCase()).toContain('matched');
  });
});
