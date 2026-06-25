import type { StellarNetwork } from '@app-types';

export function mergePopulatedFields<T extends object>(
  previous?: T,
  next?: T,
): T | undefined {
  if (!previous && !next) {
    return undefined;
  }

  const result = { ...(previous || {}) } as T;

  for (const [key, value] of Object.entries(next || {})) {
    if (value !== undefined && value !== null && value !== '') {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

export function isStellarNetwork(value: unknown): value is StellarNetwork {
  return value === 'mainnet' || value === 'testnet';
}
