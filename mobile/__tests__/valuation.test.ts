import type { AssetItem, BalanceItem } from '../src/types';
import {
  calculatePortfolioValuation,
  getModernAssets,
} from '../src/components/wallet/ui/helpers';

function makeAsset(
  assetCode: string,
  assetIssuer: string | null,
  priceUsd?: number | null,
): AssetItem {
  return {
    assetCode,
    assetIssuer,
    demo: false,
    displayName: assetCode,
    isNative: assetCode === 'XLM' && !assetIssuer,
    network: 'mainnet',
    priceUsd,
    trustLevel: 'verified',
  };
}

function makeBalance(
  assetCode: string,
  assetIssuer: string | null,
  balance: string,
): BalanceItem {
  return {
    ...makeAsset(assetCode, assetIssuer),
    balance,
    exists: true,
    trusted: true,
  };
}

test('values balances only when the API supplied a market price', () => {
  const valuation = calculatePortfolioValuation([
    { ...makeBalance('XLM', null, '10'), priceUsd: 0.2 },
    makeBalance('USDC', 'G-UNPRICED', '5'),
  ]);

  expect(valuation.totalUsd).toBeCloseTo(2);
  expect(valuation.pricedAssetCount).toBe(1);
  expect(valuation.unpricedAssetCount).toBe(1);
});

test('merges market data by asset code and issuer', () => {
  const officialIssuer = 'G-OFFICIAL';
  const otherIssuer = 'G-OTHER';
  const assets = getModernAssets(
    [
      makeBalance('USDC', officialIssuer, '12'),
      makeBalance('USDC', otherIssuer, '7'),
    ],
    [
      makeAsset('USDC', officialIssuer, 1.001),
      makeAsset('USDC', otherIssuer, 0.42),
    ],
  );

  expect(
    assets.find(asset => asset.assetIssuer === officialIssuer)?.priceUsd,
  ).toBe(1.001);
  expect(
    assets.find(asset => asset.assetIssuer === otherIssuer)?.priceUsd,
  ).toBe(0.42);
});
