import { describe, expect, it } from 'vitest';
import { LAB_PRESETS, labPresetFromHash, labPresetHash } from './config';

describe('Lab preset deep links (#lab/<presetId>)', () => {
  it('round-trips every preset and ignores the plain Lab hash and unknown ids', () => {
    for (const preset of LAB_PRESETS) {
      expect(labPresetHash(preset.id)).toBe(`#lab/${preset.id}`);
      expect(labPresetFromHash(labPresetHash(preset.id))?.id).toBe(preset.id);
      expect(labPresetFromHash(`lab/${preset.id}`)?.id).toBe(preset.id);
    }
    expect(labPresetFromHash('#lab')).toBeNull();
    expect(labPresetFromHash('#lab/')).toBeNull();
    expect(labPresetFromHash('#lab/nonsense')).toBeNull();
    expect(labPresetFromHash('#learn/money')).toBeNull();
    expect(labPresetFromHash('')).toBeNull();
  });
  it('the lessons link to presets that exist', () => {
    for (const id of ['flatBanker', 'martingalePlayer', 'paroliStreaks', 'oneThreeTwoSixBanker', 'countDragon7']) {
      expect(labPresetFromHash(`#lab/${id}`)).not.toBeNull();
    }
  });
});
