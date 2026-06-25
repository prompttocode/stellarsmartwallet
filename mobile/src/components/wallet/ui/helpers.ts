import { useMemo } from 'react';
import type { AssetItem, BalanceItem } from '@app-types';

function getAssetKey(asset: AssetItem) {
  return asset.isNative
    ? `${asset.network}:native`
    : `${asset.network}:${asset.assetCode}:${asset.assetIssuer || ''}`;
}

export function calculatePortfolioValuation(assets: BalanceItem[]) {
  return assets.reduce(
    (valuation, asset) => {
      const amount = Number(asset.balance) || 0;

      if (amount <= 0) {
        return valuation;
      }

      valuation.positiveAssetCount += 1;

      if (
        typeof asset.priceUsd !== 'number' ||
        !Number.isFinite(asset.priceUsd) ||
        asset.priceUsd <= 0
      ) {
        valuation.unpricedAssetCount += 1;
        return valuation;
      }

      valuation.pricedAssetCount += 1;
      valuation.totalUsd += amount * asset.priceUsd;
      return valuation;
    },
    {
      positiveAssetCount: 0,
      pricedAssetCount: 0,
      totalUsd: 0,
      unpricedAssetCount: 0,
    },
  );
}

export function getModernAssets(
  balances: BalanceItem[],
  visibleAssets: AssetItem[],
) {
  const merged = new Map<string, BalanceItem>();

  for (const asset of visibleAssets) {
    const balance = balances.find(item => getAssetKey(item) === getAssetKey(asset));

    merged.set(getAssetKey(asset), {
      ...asset,
      ...balance,
      image: asset.image || balance?.image || null,
      priceUsd: asset.priceUsd ?? balance?.priceUsd ?? null,
      rating: asset.rating ?? balance?.rating ?? null,
      volume7d: asset.volume7d ?? balance?.volume7d ?? null,
      balance: balance?.balance || '0',
      exists: balance?.exists || false,
      trusted: balance?.trusted ?? asset.isNative,
    });
  }

  for (const balance of balances) {
    const key = getAssetKey(balance);

    if (!merged.has(key)) {
      merged.set(key, balance);
    }
  }

  return [...merged.values()];
}

export function getWalletAssets(
  balances: BalanceItem[],
  visibleAssets: AssetItem[],
  favoriteAssets: AssetItem[] = [],
) {
  const merged = new Map<string, BalanceItem>();

  for (const balance of balances) {
    const marketAsset = visibleAssets.find(
      asset => getAssetKey(asset) === getAssetKey(balance),
    );

    merged.set(getAssetKey(balance), {
      ...marketAsset,
      ...balance,
      image: marketAsset?.image || balance.image || null,
      priceUsd: marketAsset?.priceUsd ?? balance.priceUsd ?? null,
      rating: marketAsset?.rating ?? balance.rating ?? null,
      volume7d: marketAsset?.volume7d ?? balance.volume7d ?? null,
    });
  }

  for (const favorite of favoriteAssets) {
    const key = getAssetKey(favorite);

    if (merged.has(key)) {
      continue;
    }

    const marketAsset = visibleAssets.find(asset => getAssetKey(asset) === key);
    const isNative = favorite.isNative || (favorite.assetCode === 'XLM' && !favorite.assetIssuer);

    merged.set(key, {
      ...favorite,
      ...marketAsset,
      assetCode: favorite.assetCode,
      assetIssuer: favorite.assetIssuer,
      balance: '0',
      demo: favorite.demo,
      displayName: favorite.displayName || marketAsset?.displayName || favorite.assetCode,
      exists: false,
      homeDomain: favorite.homeDomain || marketAsset?.homeDomain || null,
      image: marketAsset?.image || favorite.image || null,
      isNative,
      network: favorite.network,
      priceUsd: marketAsset?.priceUsd ?? favorite.priceUsd ?? null,
      rating: marketAsset?.rating ?? favorite.rating ?? null,
      trusted: isNative,
      trustLevel: marketAsset?.trustLevel || favorite.trustLevel,
      volume7d: marketAsset?.volume7d ?? favorite.volume7d ?? null,
    });
  }

  const favoriteOrder = new Map(
    favoriteAssets.map((asset, index) => [getAssetKey(asset), index]),
  );

  return [...merged.values()].sort((a, b) => {
    const aFavoriteIndex = favoriteOrder.get(getAssetKey(a));
    const bFavoriteIndex = favoriteOrder.get(getAssetKey(b));
    const aFavorite = typeof aFavoriteIndex === 'number';
    const bFavorite = typeof bFavoriteIndex === 'number';

    if (aFavorite && bFavorite) {
      return aFavoriteIndex - bFavoriteIndex;
    }

    if (aFavorite) {
      return -1;
    }

    if (bFavorite) {
      return 1;
    }

    return 0;
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
