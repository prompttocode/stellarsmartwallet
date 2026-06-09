import {
  getRampOrderStatus,
  isRampOrderTerminal,
  rampTimestampToMs,
} from '../src/utils/ramp';

test('maps processing and terminal order states', () => {
  const order = {
    amount: 10,
    asset_code: 'XLM' as const,
    chain_id: 1,
    code: 'DHA123',
    id: '1',
    order_type: 'buy' as const,
    processing_state: 13,
    state: 2,
  };

  expect(getRampOrderStatus(order)).toBe('Waiting for crypto transfer');
  expect(isRampOrderTerminal(order)).toBe(false);
  expect(isRampOrderTerminal({ ...order, state: 3 })).toBe(true);
});

test('parses payment protobuf timestamps', () => {
  expect(rampTimestampToMs({ seconds: 100, nanos: 500_000_000 })).toBe(100500);
});
