import type { AssetItem } from '@app-types';

export type AssetIdentityInput = Pick<
  AssetItem,
  'assetCode' | 'assetIssuer' | 'isNative' | 'network'
>;

export function getAssetIdentity(asset: AssetIdentityInput) {
  return asset.isNative
    ? `${asset.network}:native`
    : `${asset.network}:${asset.assetCode}:${asset.assetIssuer || ''}`;
}

export function hasMarketPrice(asset: AssetItem) {
  return (
    typeof asset.priceUsd === 'number' &&
    Number.isFinite(asset.priceUsd) &&
    asset.priceUsd > 0
  );
}

export function mergeAssetMarketData(
  nextAssets: AssetItem[],
  previousAssets: AssetItem[],
) {
  const previousByIdentity = new Map(
    previousAssets.map(asset => [getAssetIdentity(asset), asset]),
  );

  return nextAssets.map(asset => {
    const previous = previousByIdentity.get(getAssetIdentity(asset));

    return {
      ...asset,
      image: asset.image || previous?.image || null,
      priceUsd: hasMarketPrice(asset)
        ? asset.priceUsd
        : previous?.priceUsd ?? null,
      rating: asset.rating ?? previous?.rating ?? null,
      volume7d: asset.volume7d ?? previous?.volume7d ?? null,
    };
  });
}

export function applyReferenceMarketPrices(
  testnetAssets: AssetItem[],
  mainnetAssets: AssetItem[],
) {
  const nativeReference = mainnetAssets.find(
    asset => asset.isNative && hasMarketPrice(asset),
  );
  const referencesByCode = new Map<string, AssetItem>();

  for (const asset of mainnetAssets) {
    if (!hasMarketPrice(asset) || referencesByCode.has(asset.assetCode)) {
      continue;
    }

    referencesByCode.set(asset.assetCode, asset);
  }

  return testnetAssets.map(asset => {
    const reference = asset.isNative
      ? nativeReference
      : referencesByCode.get(asset.assetCode);

    if (!reference) {
      return asset;
    }

    return {
      ...asset,
      image: asset.image || reference.image || null,
      priceUsd: reference.priceUsd ?? asset.priceUsd ?? null,
      rating: asset.rating ?? reference.rating ?? null,
      volume7d: reference.volume7d ?? asset.volume7d ?? null,
    };
  });
}
