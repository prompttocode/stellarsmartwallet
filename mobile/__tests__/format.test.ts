import { maskEmailForDisplay } from '../src/utils/format';

describe('maskEmailForDisplay', () => {
  it('keeps only the first local-part character and domain', () => {
    expect(maskEmailForDisplay('nam123@gmail.com')).toBe('n*****@gmail.com');
  });

  it('does not invent an address for missing or malformed values', () => {
    expect(maskEmailForDisplay()).toBe('No email');
    expect(maskEmailForDisplay('not-an-email')).toBe('not-an-email');
  });
});
