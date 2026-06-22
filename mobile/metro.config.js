const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};
const defaultConfig = getDefaultConfig(__dirname);
const aliases = {
  '@api': path.resolve(__dirname, 'src/api'),
  '@app-types': path.resolve(__dirname, 'src/types'),
  '@assets': path.resolve(__dirname, 'src/assets'),
  '@components': path.resolve(__dirname, 'src/components'),
  '@config': path.resolve(__dirname, 'src/config'),
  '@constants': path.resolve(__dirname, 'src/constants'),
  '@contexts': path.resolve(__dirname, 'src/contexts'),
  '@hooks': path.resolve(__dirname, 'src/hooks'),
  '@screens': path.resolve(__dirname, 'src/screens'),
  '@styles': path.resolve(__dirname, 'src/styles'),
  '@utils': path.resolve(__dirname, 'src/utils'),
};

const resolveAlias = (context, moduleName, platform) => {
  const alias = Object.keys(aliases).find(
    item => moduleName === item || moduleName.startsWith(`${item}/`),
  );

  if (!alias) {
    return null;
  }

  const target =
    moduleName === alias
      ? aliases[alias]
      : path.join(aliases[alias], moduleName.slice(alias.length + 1));

  return context.resolveRequest(context, target, platform);
};

const resolveRequestWithPackageExports = (context, moduleName, platform) => {
  const aliasResolution = resolveAlias(context, moduleName, platform);

  if (aliasResolution) {
    return aliasResolution;
  }

  if (moduleName === 'isows') {
    const ctx = {
      ...context,
      unstable_enablePackageExports: false,
    };
    return ctx.resolveRequest(ctx, moduleName, platform);
  }

  if (moduleName.startsWith('zustand')) {
    const ctx = {
      ...context,
      unstable_enablePackageExports: false,
    };
    return ctx.resolveRequest(ctx, moduleName, platform);
  }

  if (moduleName === 'jose') {
    const ctx = {
      ...context,
      unstable_conditionNames: ['browser'],
    };
    return ctx.resolveRequest(ctx, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = mergeConfig(defaultConfig, {
  ...config,
  resolver: {
    ...(defaultConfig.resolver || {}),
    ...(config.resolver || {}),
    resolveRequest: resolveRequestWithPackageExports,
  },
});
