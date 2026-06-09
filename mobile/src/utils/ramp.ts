import type { RampOrder, RampTimestamp } from '@app-types';

export const TERMINAL_RAMP_STATES = new Set([3, 4, 5]);

export const RAMP_STATE_LABELS: Record<number, string> = {
  1: 'Created',
  2: 'Processing',
  3: 'Completed',
  4: 'Failed',
  5: 'Cancelled',
};

export const RAMP_PROCESSING_LABELS: Record<number, string> = {
  10: 'Waiting for VND payment',
  11: 'VND payment confirmed',
  12: 'VND payment failed',
  13: 'Waiting for crypto transfer',
  14: 'Crypto sent',
  15: 'Crypto transfer failed',
  16: 'Waiting for admin approval',
};

export function isRampOrderTerminal(order?: RampOrder | null) {
  return Boolean(order && TERMINAL_RAMP_STATES.has(Number(order.state)));
}

export function rampTimestampToMs(value?: RampTimestamp) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  return Number(value.seconds) * 1000 + Math.floor(Number(value.nanos || 0) / 1e6);
}

export function getRampOrderStatus(order: RampOrder) {
  const state = Number(order.state);

  if (TERMINAL_RAMP_STATES.has(state)) {
    return RAMP_STATE_LABELS[state] || 'Unknown status';
  }

  return (
    RAMP_PROCESSING_LABELS[Number(order.processing_state)] ||
    RAMP_STATE_LABELS[state] ||
    'Unknown status'
  );
}
