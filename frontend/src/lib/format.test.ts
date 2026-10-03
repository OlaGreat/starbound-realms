import { describe, it, expect } from 'vitest';
import { truncateAddress } from './format';

describe('truncateAddress', () => {
  it('shows the first 6 and last 4 characters, joined by an ellipsis', () => {
    expect(truncateAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR'))
      .toBe('GABCDE...OPQR');
  });

  it('returns a short address unchanged rather than mangling it', () => {
    expect(truncateAddress('GSHORT')).toBe('GSHORT');
  });
});
