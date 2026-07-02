import {
  normalizeStellarAmountInput,
  sanitizeStellarAmountInput,
  validateStellarAmount,
} from '../src/utils/walletValidation';
import { formatTokenAmount } from '../src/utils/format';

describe('Stellar amount input', () => {
  it('accepts comma and dot as decimal separators', () => {
    expect(sanitizeStellarAmountInput('9998,4999')).toBe('9998.4999');
    expect(sanitizeStellarAmountInput('9998.4999')).toBe('9998.4999');
  });

  it('normalizes pasted amounts that include grouping separators', () => {
    expect(normalizeStellarAmountInput('9,998.4999')).toBe('9998.4999');
    expect(normalizeStellarAmountInput('9.998,4999')).toBe('9998.4999');
  });

  it('does not infer decimals from plain digits', () => {
    expect(normalizeStellarAmountInput('99984999')).toBe('99984999');
  });

  it('keeps ambiguous repeated separators invalid instead of guessing', () => {
    expect(validateStellarAmount('1,234,567').valid).toBe(false);
  });

  it('displays token amounts without grouping separators', () => {
    expect(formatTokenAmount('9996.525')).toBe('9996.53');
    expect(formatTokenAmount('9996.525', { maxFractionDigits: 7 })).toBe(
      '9996.525',
    );
  });
});
