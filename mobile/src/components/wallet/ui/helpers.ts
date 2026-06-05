import { useMemo } from 'react';
import type { AssetItem, BalanceItem } from '@app-types';

export function calculateTotalUsdValue(balances: BalanceItem[]): number {
  return balances.reduce((sum, balance) => {
    const amount = Number(balance.balance) || 0;

    if (balance.assetCode === 'XLM') {
      return sum + amount * 0.12;
    }

    if (
      balance.assetCode === 'EURC' ||
      balance.assetCode === 'PYUSD' ||
      balance.assetCode === 'USDC' ||
      balance.assetCode === 'USDT' ||
      balance.assetCode === 'yUSDC'
    ) {
      return sum + amount;
    }

    return sum;
  }, 0);
}

export function getModernAssets(
  balances: BalanceItem[],
  visibleAssets: AssetItem[],
) {
  return visibleAssets.map<BalanceItem>(asset => {
    const balance = balances.find(
      item =>
        item.assetCode === asset.assetCode &&
        (item.assetIssuer || null) === (asset.assetIssuer || null),
    );

    if (balance) {
      return balance;
    }

    return {
      ...asset,
      balance: '0',
      exists: false,
      trusted: asset.isNative,
    };
  });
}

export function useDistinctAssetPair(assets: AssetItem[], initialFrom: string) {
  return useMemo(() => {
    const fallback = assets[0]?.assetCode || 'XLM';
    const from = assets.some(asset => asset.assetCode === initialFrom)
      ? initialFrom
      : fallback;
    const to =
      assets.find(asset => asset.assetCode !== from)?.assetCode ||
      (from === 'XLM' ? 'USDC' : 'XLM');

    return { from, to };
  }, [assets, initialFrom]);
}
