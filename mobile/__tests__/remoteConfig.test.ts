import { Platform } from 'react-native';
import {
  ensureInitialized,
  fetchAndActivate,
  getRemoteConfig,
  getValue,
} from '@react-native-firebase/remote-config';
import * as config from '../src/config';
import { initializeRemoteFeatureFlags } from '../src/services/remoteConfig';

jest.mock('@react-native-firebase/remote-config', () => ({
  ensureInitialized: jest.fn(),
  fetchAndActivate: jest.fn(),
  getRemoteConfig: jest.fn(),
  getValue: jest.fn(),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

function remoteValue(
  enabled: boolean,
  source: 'remote' | 'default' = 'remote',
) {
  return {
    asBoolean: () => enabled,
    asNumber: () => Number(enabled),
    asString: () => String(enabled),
    getSource: () => source,
  };
}

let instance: {
  app: { options: { projectId: string } };
  fetchTimeMillis: number;
  lastFetchStatus: string;
  setDefaults: jest.Mock;
  setConfigSettings: jest.Mock;
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  config.setSwapEnabled(true);
  config.setVndEnabled(true);
  instance = {
    app: { options: { projectId: 'orbitwallet-cad50' } },
    fetchTimeMillis: 1234,
    lastFetchStatus: 'success',
    setDefaults: jest.fn(async () => undefined),
    setConfigSettings: jest.fn(async () => undefined),
  };
  jest
    .mocked(getRemoteConfig)
    .mockReturnValue(instance as unknown as ReturnType<typeof getRemoteConfig>);
  jest.mocked(ensureInitialized).mockResolvedValue(undefined);
  jest.mocked(fetchAndActivate).mockResolvedValue(false);
  jest.mocked(getValue).mockReturnValue(remoteValue(false));
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each([
  [true, true],
  [true, false],
  [false, true],
  [false, false],
])(
  'applies independent Swap=%s and VND=%s flags from one fetch',
  async (swap, vnd) => {
    jest
      .mocked(getValue)
      .mockImplementation((_instance, key) =>
        remoteValue(key === 'swap_enabled' ? swap : vnd),
      );
    await initializeRemoteFeatureFlags();

    expect(config.SWAP_ENABLED).toBe(swap);
    expect(config.VND_ENABLED).toBe(vnd);
    expect(fetchAndActivate).toHaveBeenCalledTimes(1);
    expect(getValue).toHaveBeenCalledTimes(2);
    expect(instance.setDefaults).toHaveBeenCalledWith({
      swap_enabled: false,
      vnd_enabled: false,
    });
    expect(instance.setConfigSettings).toHaveBeenCalledWith({
      fetchTimeMillis: 5000,
      minimumFetchIntervalMillis: 0,
    });
    expect(console.info).toHaveBeenCalledWith(
      '[FeatureFlags] applied',
      expect.stringContaining(`"swap_enabled":{"enabled":${swap}`),
    );
  },
);

test('waits for native defaults and settings before fetching', async () => {
  let finishDefaults!: () => void;
  let finishSettings!: () => void;
  instance.setDefaults.mockReturnValue(
    new Promise<void>(resolve => {
      finishDefaults = resolve;
    }),
  );
  instance.setConfigSettings.mockReturnValue(
    new Promise<void>(resolve => {
      finishSettings = resolve;
    }),
  );

  const initialization = initializeRemoteFeatureFlags();
  expect(instance.setConfigSettings).not.toHaveBeenCalled();
  expect(fetchAndActivate).not.toHaveBeenCalled();
  finishDefaults();
  await Promise.resolve();
  expect(instance.setConfigSettings).toHaveBeenCalledTimes(1);
  expect(fetchAndActivate).not.toHaveBeenCalled();
  finishSettings();
  await initialization;
  expect(fetchAndActivate).toHaveBeenCalledTimes(1);
});

test('does not enable features from a local default when the remote key is missing', async () => {
  jest.mocked(getValue).mockReturnValue(remoteValue(true, 'default'));
  await initializeRemoteFeatureFlags();
  expect(config.SWAP_ENABLED).toBe(false);
  expect(config.VND_ENABLED).toBe(false);
});

test.each(['swap_enabled', 'vnd_enabled'])(
  'a missing %s does not disable the other remote flag',
  async missingKey => {
    jest
      .mocked(getValue)
      .mockImplementation((_instance, key) =>
        remoteValue(true, key === missingKey ? 'default' : 'remote'),
      );
    await initializeRemoteFeatureFlags();
    expect(config.SWAP_ENABLED).toBe(missingKey !== 'swap_enabled');
    expect(config.VND_ENABLED).toBe(missingKey !== 'vnd_enabled');
  },
);

test('does not use the legacy combined flag as fallback', async () => {
  jest
    .mocked(getValue)
    .mockImplementation((_instance, key) =>
      remoteValue(
        true,
        key === 'exchange_features_enabled' ? 'remote' : 'default',
      ),
    );
  await initializeRemoteFeatureFlags();
  expect(config.SWAP_ENABLED).toBe(false);
  expect(config.VND_ENABLED).toBe(false);
  expect(getValue).not.toHaveBeenCalledWith(
    instance,
    'exchange_features_enabled',
  );
});

test('does not enable features if fetching fails, even when a cached remote value is true', async () => {
  jest.mocked(getValue).mockReturnValue(remoteValue(true));
  jest
    .mocked(fetchAndActivate)
    .mockRejectedValueOnce(new Error('Network unavailable'));
  await initializeRemoteFeatureFlags();
  expect(config.SWAP_ENABLED).toBe(false);
  expect(config.VND_ENABLED).toBe(false);
  expect(console.warn).toHaveBeenCalledWith(
    '[FeatureFlags] fetch-failed; exchange features remain disabled',
    expect.stringContaining('Network unavailable'),
  );
});

test('a late fetch result cannot turn features on after startup timed out', async () => {
  jest.useFakeTimers();
  let finishFetch!: (activated: boolean) => void;
  jest.mocked(fetchAndActivate).mockReturnValueOnce(
    new Promise<boolean>(resolve => {
      finishFetch = resolve;
    }),
  );
  jest.mocked(getValue).mockReturnValue(remoteValue(true));
  const initialization = initializeRemoteFeatureFlags();
  await jest.advanceTimersByTimeAsync(5000);
  await initialization;
  expect(config.SWAP_ENABLED).toBe(false);
  expect(config.VND_ENABLED).toBe(false);
  finishFetch(true);
  await Promise.resolve();
  await Promise.resolve();
  expect(config.SWAP_ENABLED).toBe(false);
  expect(config.VND_ENABLED).toBe(false);
});

test('keeps features disabled when Firebase is not configured for the current app', async () => {
  jest.mocked(getRemoteConfig).mockImplementationOnce(() => {
    throw new Error('No Firebase App has been created');
  });
  await initializeRemoteFeatureFlags();
  expect(config.SWAP_ENABLED).toBe(false);
  expect(config.VND_ENABLED).toBe(false);
  expect(fetchAndActivate).not.toHaveBeenCalled();
});
test('Android stays enabled without fetching Firebase', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  config.setSwapEnabled(false);
  config.setVndEnabled(false);
  await initializeRemoteFeatureFlags();
  expect(config.SWAP_ENABLED).toBe(true);
  expect(config.VND_ENABLED).toBe(true);
  expect(getRemoteConfig).not.toHaveBeenCalled();
  expect(fetchAndActivate).not.toHaveBeenCalled();
});
