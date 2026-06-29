import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { modern } from '../modernStyles';

const assetColors: Record<string, { bg: string; fg: string }> = {
  AQUA: { bg: '#E5F8FF', fg: '#087EA4' },
  EURC: { bg: '#EAF3FF', fg: '#1F66C2' },
  PYUSD: { bg: '#EEF5FF', fg: '#153B7D' },
  USDC: { bg: '#EAF5FF', fg: '#2374D7' },
  USDT: { bg: '#E5FAF1', fg: '#0ABF73' },
  XLM: { bg: '#EEF3F5', fg: '#132A35' },
  yUSDC: { bg: '#F0F7FF', fg: '#315A94' },
  yXLM: { bg: '#F2F6F8', fg: '#284653' },
};

const xlmImage = require('@assets/images/coin/xlm.png');

export function SmartRemoteImage({
  uri,
  width,
  height,
  borderRadius,
  fallback,
}: {
  uri: string;
  width: number;
  height: number;
  borderRadius?: number;
  fallback: React.ReactNode;
}) {
  const [isSvg, setIsSvg] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function determineType() {
      try {
        const res = await fetch(uri, { method: 'HEAD' });
        const contentType =
          res.headers.get('content-type') ||
          res.headers.get('Content-Type') ||
          '';

        if (active) {
          setIsSvg(contentType.toLowerCase().includes('svg'));
        }
      } catch {
        if (active) {
          // Fallback based on extension if HEAD request fails
          const lower = uri.toLowerCase();
          setIsSvg(lower.endsWith('.svg'));
        }
      }
    }

    determineType();
    return () => {
      active = false;
    };
  }, [uri]);

  if (isSvg === null) {
    return <>{fallback}</>;
  }

  if (isSvg) {
    return (
      <SvgUri
        uri={uri}
        width={width}
        height={height}
        onError={() => {
          setIsSvg(false);
        }}
      />
    );
  }

  return (
    <Image
      resizeMode="contain"
      source={{ uri }}
      style={{
        height: height,
        width: width,
        borderRadius: borderRadius || 0,
      }}
      onError={() => {
        setIsSvg(null); // Fallback to placeholder if image fails to load
      }}
    />
  );
}

export function TokenIcon({
  assetCode,
  size = 46,
  imageUrl,
}: {
  assetCode: string;
  size?: number;
  imageUrl?: string | null;
}) {
  const colors = assetColors[assetCode] || { bg: '#EEF3F5', fg: '#24495A' };
  const fallbackImage = assetCode === 'XLM' ? xlmImage : null;
  const placeholder = (
    <Text style={[modern.tokenIconText, { color: colors.fg }]}>
      {assetCode.slice(0, 1)}
    </Text>
  );
  const fallback = fallbackImage ? (
    <Image
      resizeMode="contain"
      source={fallbackImage}
      style={{ height: size * 0.7, width: size * 0.7 }}
    />
  ) : (
    placeholder
  );

  return (
    <View
      style={[
        modern.tokenIcon,
        {
          backgroundColor: colors.bg,
          height: size,
          width: size,
        },
      ]}
    >
      {imageUrl ? (
        <SmartRemoteImage
          uri={imageUrl}
          width={size * 0.7}
          height={size * 0.7}
          borderRadius={size * 0.35}
          fallback={fallback}
        />
      ) : fallbackImage ? (
        fallback
      ) : (
        placeholder
      )}
    </View>
  );
}
