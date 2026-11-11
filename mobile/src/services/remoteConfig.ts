import {
  ensureInitialized,
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  type FirebaseRemoteConfigTypes,
} from '@react-native-firebase/remote-config';
import { setSwapEnabled, setVndEnabled } from '@config';
import { Platform } from 'react-native';

export const SWAP_REMOTE_KEY = 'swap_enabled';
export const VND_REMOTE_KEY = 'vnd_enabled';

const FETCH_TIMEOUT_MS = 5_000;

type AwaitableRemoteConfig = ReturnType<typeof getRemoteConfig> &
  Pick<FirebaseRemoteConfigTypes.Module, 'setDefaults' | 'setConfigSettings'>;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Firebase Remote Config fetch timed out.')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function fetchFeatureFlags() {
  const remoteConfig = getRemoteConfig() as AwaitableRemoteConfig;

  // RNFirebase's property setters schedule asynchronous native mutations.
  // Await the public methods so fetch uses the requested native settings.
  await remoteConfig.setDefaults({
    [SWAP_REMOTE_KEY]: false,
    [VND_REMOTE_KEY]: false,
  });
  await remoteConfig.setConfigSettings({
    fetchTimeMillis: FETCH_TIMEOUT_MS,
    minimumFetchIntervalMillis: 0,
  });
  await ensureInitialized(remoteConfig);

  const activatedNewConfig = await fetchAndActivate(remoteConfig);
  function readFlag(key: string) {
    const value = getValue(remoteConfig, key);
    const source = value.getSource();
    return {
      enabled:
        remoteConfig.lastFetchStatus === 'success' &&
        source === 'remote' &&
        value.asBoolean(),
      rawValue: value.asString(),
      source,
    };
  }

  return {
    activatedNewConfig,
    flags: {
      [SWAP_REMOTE_KEY]: readFlag(SWAP_REMOTE_KEY),
      [VND_REMOTE_KEY]: readFlag(VND_REMOTE_KEY),
    },
    fetchStatus: remoteConfig.lastFetchStatus,
    lastFetchTimeMillis: remoteConfig.fetchTimeMillis,
    projectId: remoteConfig.app.options.projectId,
  };
}

export async function initializeRemoteFeatureFlags(): Promise<void> {
  if (Platform.OS === 'android') {
    setSwapEnabled(true);
    setVndEnabled(true);
    return;
  }

  // Never turn on exchange features because a fetch failed or a key is absent.
  setSwapEnabled(false);
  setVndEnabled(false);
  console.info('[FeatureFlags] fetch-start', [SWAP_REMOTE_KEY, VND_REMOTE_KEY]);

  try {
    const result = await withTimeout(fetchFeatureFlags(), FETCH_TIMEOUT_MS);
    setSwapEnabled(result.flags[SWAP_REMOTE_KEY].enabled);
    setVndEnabled(result.flags[VND_REMOTE_KEY].enabled);
    console.info('[FeatureFlags] applied', JSON.stringify(result));
  } catch (error) {
    setSwapEnabled(false);
    setVndEnabled(false);
    console.warn(
      '[FeatureFlags] fetch-failed; exchange features remain disabled',
      JSON.stringify({
        flags: { [SWAP_REMOTE_KEY]: false, [VND_REMOTE_KEY]: false },
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
