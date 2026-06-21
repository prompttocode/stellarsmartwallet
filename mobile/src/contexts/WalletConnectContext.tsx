import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Linking,
  type AppStateStatus,
} from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';
import { useIdentityToken } from '@privy-io/expo';
import type WalletKitClient from '@reown/walletkit';
import type {
  PendingRequestTypes,
  ProposalTypes,
  SessionTypes,
  SignClientTypes,
} from '@walletconnect/types';
import {
  formatJsonRpcError,
  formatJsonRpcResult,
} from '@walletconnect/jsonrpc-utils';
import {
  buildApprovedNamespaces,
  getSdkError,
} from '@walletconnect/utils';

import { api } from '@api/client';
import { useAppPopup } from '@components/common/AppPopup';
import type { StellarNetwork } from '@app-types';
import type { WalletState } from '@hooks/useWallet';
import { getWalletKit } from '../walletconnect/client';

const STELLAR_METHODS = [
  'stellar_signXDR',
  'stellar_signAndSubmitXDR',
] as const;

type StellarMethod = (typeof STELLAR_METHODS)[number];

export type WalletConnectAssetReview = {
  code: string;
  issuer: string | null;
};

export type WalletConnectOperationReview = {
  amount?: string;
  asset?: WalletConnectAssetReview | null;
  buyAmount?: string;
  buying?: WalletConnectAssetReview | null;
  destination?: string;
  destinationAmount?: string;
  destinationAsset?: WalletConnectAssetReview | null;
  destinationMinimum?: string;
  limit?: string;
  offerId?: string | null;
  path?: Array<WalletConnectAssetReview | null>;
  price?: string;
  selling?: WalletConnectAssetReview | null;
  sendAmount?: string;
  sendAsset?: WalletConnectAssetReview | null;
  sendMaximum?: string;
  source?: string | null;
  startingBalance?: string;
  type: string;
};

export type WalletConnectXdrReview = {
  fee: string;
  memo: string | null;
  network: StellarNetwork;
  operationCount: number;
  operations: WalletConnectOperationReview[];
  sequence: string;
  source: string;
  warnings: string[];
};

type WalletConnectSignResponse = {
  hash: string | null;
  signedXdr: string;
  submitted: { hash?: string } | null;
};

export type WalletConnectSessionView = {
  address: string;
  expiry: number;
  icon: string | null;
  name: string;
  network: StellarNetwork;
  topic: string;
  url: string;
};

export type WalletConnectProposalView = {
  chains: string[];
  icon: string | null;
  id: number;
  methods: string[];
  name: string;
  url: string;
};

export type WalletConnectRequestView = {
  chainId: string;
  id: number;
  method: StellarMethod;
  peerIcon: string | null;
  peerName: string;
  peerUrl: string;
  review: WalletConnectXdrReview | null;
  reviewError: string | null;
  reviewing: boolean;
  topic: string;
};

export type WalletConnectResult = {
  hash: string | null;
  method: StellarMethod;
  peerName: string;
};

type SessionRequestEvent = PendingRequestTypes.Struct;

type WalletConnectContextValue = {
  approveProposal: () => Promise<void>;
  approveRequest: () => Promise<void>;
  configured: boolean;
  disconnectSession: (topic: string) => Promise<void>;
  initializing: boolean;
  lastError: string | null;
  pair: (uri: string) => Promise<boolean>;
  pairing: boolean;
  proposal: WalletConnectProposalView | null;
  rejectProposal: () => Promise<void>;
  rejectRequest: () => Promise<void>;
  request: WalletConnectRequestView | null;
  result: WalletConnectResult | null;
  sessions: WalletConnectSessionView[];
  clearResult: () => void;
};

const WalletConnectContext =
  createContext<WalletConnectContextValue | null>(null);

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTokenWithRetry(getToken: () => Promise<string | null>) {
  for (const delay of [0, 300, 700, 1200]) {
    if (delay) {
      await wait(delay);
    }

    const token = await getToken().catch(() => null);

    if (token) {
      return token;
    }
  }

  return null;
}

function getChainId(network: StellarNetwork) {
  return network === 'mainnet' ? 'stellar:pubnet' : 'stellar:testnet';
}

function getAccountId(network: StellarNetwork, address: string) {
  return `${getChainId(network)}:${address}`;
}

function getNetworkFromChainId(chainId: string): StellarNetwork | null {
  if (chainId === 'stellar:pubnet') {
    return 'mainnet';
  }

  if (chainId === 'stellar:testnet') {
    return 'testnet';
  }

  return null;
}

type ProposalNamespaceScope = 'all' | 'required';

function getProposalNamespaces(
  proposal: ProposalTypes.Struct,
  scope: ProposalNamespaceScope = 'all',
) {
  if (scope === 'required') {
    return proposal.requiredNamespaces;
  }

  return {
    ...proposal.requiredNamespaces,
    ...proposal.optionalNamespaces,
  };
}

function getProposalChains(
  proposal: ProposalTypes.Struct,
  scope: ProposalNamespaceScope = 'all',
) {
  const chains = new Set<string>();
  const namespaces = getProposalNamespaces(proposal, scope);

  for (const [key, namespace] of Object.entries(namespaces)) {
    if (key.startsWith('stellar:')) {
      chains.add(key);
    }

    for (const chain of namespace.chains || []) {
      chains.add(chain);
    }
  }

  return [...chains];
}

function getProposalMethods(
  proposal: ProposalTypes.Struct,
  scope: ProposalNamespaceScope = 'all',
) {
  return [
    ...new Set(
      Object.values(getProposalNamespaces(proposal, scope)).flatMap(
        namespace => namespace.methods || [],
      ),
    ),
  ];
}

function getSessionView(session: SessionTypes.Struct) {
  const stellarNamespace =
    session.namespaces.stellar ||
    Object.entries(session.namespaces).find(([key]) =>
      key.startsWith('stellar:'),
    )?.[1];
  const account = stellarNamespace?.accounts?.[0] || '';
  const parts = account.split(':');
  const address = parts[parts.length - 1] || '';
  const chainId = parts.length >= 3 ? parts.slice(0, 2).join(':') : '';

  return {
    address,
    expiry: session.expiry,
    icon: session.peer.metadata.icons?.[0] || null,
    name: session.peer.metadata.name || 'Connected dApp',
    network: getNetworkFromChainId(chainId) || 'testnet',
    topic: session.topic,
    url: session.peer.metadata.url || '',
  } satisfies WalletConnectSessionView;
}

function extractXdr(params: unknown) {
  if (params && typeof params === 'object' && !Array.isArray(params)) {
    return String((params as { xdr?: unknown }).xdr || '').trim();
  }

  if (Array.isArray(params) && params[0] && typeof params[0] === 'object') {
    return String((params[0] as { xdr?: unknown }).xdr || '').trim();
  }

  return '';
}

function extractWalletConnectUri(url: string) {
  if (url.startsWith('wc:')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const queryUri =
      parsed.searchParams.get('uri') || parsed.searchParams.get('wc');

    if (queryUri?.startsWith('wc:')) {
      return queryUri;
    }

    const hash = decodeURIComponent(parsed.hash.replace(/^#/, ''));

    if (hash.startsWith('wc:')) {
      return hash;
    }
  } catch {
    return null;
  }

  return null;
}

function isSupportedMethod(value: string): value is StellarMethod {
  return STELLAR_METHODS.includes(value as StellarMethod);
}

export function WalletConnectProvider({
  children,
  wallet,
}: {
  children: ReactNode;
  wallet: WalletState;
}) {
  const { getIdentityToken } = useIdentityToken();
  const { showPopup } = useAppPopup();
  const walletRef = useRef(wallet);
  const clientRef = useRef<WalletKitClient | null>(null);
  const pendingPairUriRef = useRef<string | null>(null);
  const [client, setClient] = useState<WalletKitClient | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [proposalData, setProposalData] =
    useState<ProposalTypes.Struct | null>(null);
  const [requestQueue, setRequestQueue] = useState<SessionRequestEvent[]>([]);
  const [requestReview, setRequestReview] =
    useState<WalletConnectXdrReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WalletConnectSessionView[]>([]);
  const [result, setResult] = useState<WalletConnectResult | null>(null);
  const reviewingKeyRef = useRef<string | null>(null);

  walletRef.current = wallet;

  const configured = Boolean(wallet.walletConnectConfig?.projectId);
  const activeRequestEvent = requestQueue[0] || null;

  const refreshSessions = useCallback((nextClient = clientRef.current) => {
    if (!nextClient) {
      setSessions([]);
      return;
    }

    setSessions(
      Object.values(nextClient.getActiveSessions())
        .map(getSessionView)
        .sort((a, b) => b.expiry - a.expiry),
    );
  }, []);

  const respondWithError = useCallback(
    async (
      nextClient: WalletKitClient,
      event: SessionRequestEvent,
      message: string,
    ) => {
      await nextClient.respondSessionRequest({
        response: formatJsonRpcError(event.id, message),
        topic: event.topic,
      });
    },
    [],
  );

  const validateRequest = useCallback(
    async (nextClient: WalletKitClient, event: SessionRequestEvent) => {
      const currentWallet = walletRef.current;
      const method = event.params.request.method;
      const expectedChain = getChainId(currentWallet.network);
      const session = nextClient.getActiveSessions()[event.topic];
      const expectedAccount = currentWallet.wallet?.address
        ? getAccountId(currentWallet.network, currentWallet.wallet.address)
        : '';

      if (!isSupportedMethod(method)) {
        await respondWithError(
          nextClient,
          event,
          `Unsupported Stellar method: ${method}`,
        );
        return false;
      }

      if (
        event.params.chainId !== expectedChain ||
        !session ||
        !Object.values(session.namespaces).some(namespace =>
          namespace.accounts.includes(expectedAccount),
        )
      ) {
        await respondWithError(
          nextClient,
          event,
          'Wallet or Stellar network no longer matches this session.',
        );
        return false;
      }

      if (
        !currentWallet.account ||
        !currentWallet.wallet?.canSign ||
        !currentWallet.walletActive
      ) {
        await respondWithError(
          nextClient,
          event,
          'The selected Stellar wallet cannot sign this request.',
        );
        return false;
      }

      if (!extractXdr(event.params.request.params)) {
        await respondWithError(
          nextClient,
          event,
          'WalletConnect request does not contain Stellar XDR.',
        );
        return false;
      }

      return true;
    },
    [respondWithError],
  );

  useEffect(() => {
    const projectId = wallet.walletConnectConfig?.projectId;

    if (!projectId) {
      clientRef.current = null;
      setClient(null);
      setSessions([]);
      return;
    }

    let cancelled = false;
    const configuredProjectId = projectId;
    let nextClient: WalletKitClient | null = null;

    async function initialize() {
      setInitializing(true);
      setLastError(null);

      try {
        nextClient = await getWalletKit(configuredProjectId);

        if (cancelled) {
          return;
        }

        clientRef.current = nextClient;
        setClient(nextClient);
        refreshSessions(nextClient);

        const proposals = Object.values(
          nextClient.getPendingSessionProposals(),
        );
        setProposalData(proposals[0] || null);
        setRequestQueue(nextClient.getPendingSessionRequests());

        if (pendingPairUriRef.current) {
          const uri = pendingPairUriRef.current;
          pendingPairUriRef.current = null;
          await nextClient.pair({ uri });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'WalletConnect could not initialize.';
          setLastError(message);
          showPopup({
            message,
            title: 'WalletConnect',
            variant: 'danger',
          });
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    const onProposal = (
      event: SignClientTypes.EventArguments['session_proposal'],
    ) => {
      setProposalData(current => {
        if (current && nextClient) {
          nextClient
            .rejectSession({
              id: event.id,
              reason: getSdkError('USER_REJECTED'),
            })
            .catch(() => null);
          return current;
        }

        return event.params;
      });
    };
    const onRequest = (event: SessionRequestEvent) => {
      if (!nextClient) {
        return false;
      }

      validateRequest(nextClient, event)
        .then(valid => {
          if (valid) {
            setRequestQueue(current =>
              current.some(item => item.id === event.id)
                ? current
                : [...current, event],
            );
          }
        })
        .catch(() => null);
    };
    const onDelete = () => refreshSessions(nextClient);
    const onProposalExpire = ({ id }: { id: number }) => {
      setProposalData(current => (current?.id === id ? null : current));
    };
    const onRequestExpire = ({ id }: { id: number }) => {
      setRequestQueue(current => current.filter(item => item.id !== id));
    };

    initialize().then(() => {
      if (!nextClient || cancelled) {
        return false;
      }

      nextClient.on('session_proposal', onProposal);
      nextClient.on('session_request', onRequest);
      nextClient.on('session_delete', onDelete);
      nextClient.on('proposal_expire', onProposalExpire);
      nextClient.on('session_request_expire', onRequestExpire);
    });

    return () => {
      cancelled = true;

      if (nextClient) {
        nextClient.off('session_proposal', onProposal);
        nextClient.off('session_request', onRequest);
        nextClient.off('session_delete', onDelete);
        nextClient.off('proposal_expire', onProposalExpire);
        nextClient.off('session_request_expire', onRequestExpire);
      }
    };
  }, [
    refreshSessions,
    showPopup,
    validateRequest,
    wallet.walletConnectConfig?.projectId,
  ]);

  const pair = useCallback(
    async (uri: string) => {
      const currentWallet = walletRef.current;
      const normalizedUri = uri.trim();

      if (!normalizedUri.startsWith('wc:')) {
        showPopup({
          message: 'This is not a WalletConnect URI.',
          title: 'WalletConnect',
          variant: 'warning',
        });
        return false;
      }

      if (!currentWallet.walletConnectConfig?.projectId) {
        showPopup({
          message: 'Add a Reown project ID to the Worker configuration first.',
          title: 'WalletConnect unavailable',
          variant: 'warning',
        });
        return false;
      }

      if (
        !currentWallet.wallet?.canSign ||
        !currentWallet.walletActive ||
        !currentWallet.account
      ) {
        showPopup({
          message: 'Select an active Privy wallet before connecting a dApp.',
          title: 'Signing wallet required',
          variant: 'warning',
        });
        return false;
      }

      if (!clientRef.current) {
        pendingPairUriRef.current = normalizedUri;
        return true;
      }

      setPairing(true);
      setLastError(null);

      try {
        await clientRef.current.pair({ uri: normalizedUri });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not pair this dApp.';
        setLastError(message);
        showPopup({
          message,
          title: 'WalletConnect',
          variant: 'danger',
        });
        return false;
      } finally {
        setPairing(false);
      }

      return true;
    },
    [showPopup],
  );

  useEffect(() => {
    function handleUrl(url: string) {
      const uri = extractWalletConnectUri(url);

      if (uri) {
        pair(uri).catch(() => null);
      }
    }

    Linking.getInitialURL()
      .then(url => {
        if (url) {
          handleUrl(url);
        }
      })
      .catch(() => null);
    const subscription = Linking.addEventListener('url', event =>
      handleUrl(event.url),
    );

    return () => subscription.remove();
  }, [pair]);

  useEffect(() => {
    function handleAppState(nextState: AppStateStatus) {
      if (nextState === 'active') {
        refreshSessions();
      }
    }

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => subscription.remove();
  }, [refreshSessions]);

  useEffect(() => {
    const nextClient = clientRef.current;

    if (!nextClient) {
      return;
    }

    const expectedAccount = wallet.wallet?.address
      ? getAccountId(wallet.network, wallet.wallet.address)
      : null;

    for (const session of Object.values(nextClient.getActiveSessions())) {
      const matches = Boolean(
        wallet.account &&
          wallet.wallet?.canSign &&
          wallet.walletActive &&
          expectedAccount &&
          Object.values(session.namespaces).some(namespace =>
            namespace.accounts.includes(expectedAccount),
          ),
      );

      if (!matches) {
        nextClient
          .disconnectSession({
            reason: getSdkError('USER_DISCONNECTED'),
            topic: session.topic,
          })
          .then(() => refreshSessions(nextClient))
          .catch(() => null);
      }
    }
  }, [
    refreshSessions,
    wallet.account,
    wallet.network,
    wallet.wallet?.address,
    wallet.wallet?.canSign,
    wallet.walletActive,
  ]);

  useEffect(() => {
    const event = activeRequestEvent;
    const nextClient = clientRef.current;

    if (!event || !nextClient) {
      setRequestReview(null);
      setReviewError(null);
      reviewingKeyRef.current = null;
      return;
    }

    const key = `${event.topic}:${event.id}`;

    if (reviewingKeyRef.current === key) {
      return;
    }

    let cancelled = false;
    const currentWallet = walletRef.current;
    const session = nextClient.getActiveSessions()[event.topic];
    const xdr = extractXdr(event.params.request.params);

    reviewingKeyRef.current = key;
    setRequestReview(null);
    setReviewError(null);

    api<WalletConnectXdrReview>(
      '/api/walletconnect/stellar/review-xdr',
      {
        body: JSON.stringify({
          method: event.params.request.method,
          network: currentWallet.network,
          peerName: session?.peer.metadata.name || '',
          sourceAddress: currentWallet.wallet?.address || '',
          topic: event.topic,
          xdr,
        }),
        method: 'POST',
      },
    )
      .then(review => {
        if (!cancelled) {
          setRequestReview(review);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setReviewError(
            error instanceof Error
              ? error.message
              : 'This transaction cannot be reviewed safely.',
          );
        }
      });

    return () => {
      cancelled = true;
      if (reviewingKeyRef.current === key) {
        reviewingKeyRef.current = null;
      }
    };
  }, [activeRequestEvent]);

  const proposal = useMemo<WalletConnectProposalView | null>(() => {
    if (!proposalData) {
      return null;
    }

    const metadata = proposalData.proposer.metadata;

    return {
      chains: getProposalChains(proposalData),
      icon: metadata.icons?.[0] || null,
      id: proposalData.id,
      methods: getProposalMethods(proposalData),
      name: metadata.name || 'Unknown dApp',
      url: metadata.url || '',
    };
  }, [proposalData]);

  const request = useMemo<WalletConnectRequestView | null>(() => {
    if (!activeRequestEvent || !client) {
      return null;
    }

    const session = client.getActiveSessions()[activeRequestEvent.topic];
    const metadata = session?.peer.metadata;

    return {
      chainId: activeRequestEvent.params.chainId,
      id: activeRequestEvent.id,
      method: activeRequestEvent.params.request.method as StellarMethod,
      peerIcon: metadata?.icons?.[0] || null,
      peerName: metadata?.name || 'Connected dApp',
      peerUrl: metadata?.url || '',
      review: requestReview,
      reviewError,
      reviewing: !requestReview && !reviewError,
      topic: activeRequestEvent.topic,
    };
  }, [activeRequestEvent, client, requestReview, reviewError]);

  const approveProposal = useCallback(async () => {
    const nextClient = clientRef.current;
    const event = proposalData;
    const currentWallet = walletRef.current;

    if (!nextClient || !event || !currentWallet.wallet?.address) {
      return;
    }

    const chainId = getChainId(currentWallet.network);
    const requestedChains = getProposalChains(event);
    const requiredChains = getProposalChains(event, 'required');
    const requiredMethods = getProposalMethods(event, 'required');
    const unsupportedMethod = requiredMethods.find(
      method => !isSupportedMethod(method),
    );
    const unsupportedRequiredChain = requiredChains.find(
      chain => chain !== chainId,
    );
    const activeChainRequested =
      requestedChains.length === 0 || requestedChains.includes(chainId);
    const unsupportedChain = unsupportedRequiredChain
      ? unsupportedRequiredChain
      : activeChainRequested
        ? null
        : requestedChains[0];

    if (
      !currentWallet.account ||
      !currentWallet.wallet.canSign ||
      !currentWallet.walletActive
    ) {
      showPopup({
        message: 'The selected wallet is not active or cannot sign transactions.',
        title: 'Cannot connect',
        variant: 'warning',
      });
      return;
    }

    if (unsupportedChain || unsupportedMethod) {
      await nextClient.rejectSession({
        id: event.id,
        reason: unsupportedChain
          ? getSdkError('UNSUPPORTED_CHAINS')
          : getSdkError('UNSUPPORTED_METHODS'),
      });
      setProposalData(null);
      showPopup({
        message: unsupportedChain
          ? 'This dApp requested a different Stellar network.'
          : `This dApp requested an unsupported method: ${unsupportedMethod}`,
        title: 'Unsupported request',
        variant: 'warning',
      });
      return;
    }

    try {
      const namespaces = buildApprovedNamespaces({
        proposal: event,
        supportedNamespaces: {
          stellar: {
            accounts: [
              getAccountId(
                currentWallet.network,
                currentWallet.wallet.address,
              ),
            ],
            chains: [chainId],
            events: [],
            methods: [...STELLAR_METHODS],
          },
        },
      });

      await nextClient.approveSession({
        id: event.id,
        namespaces,
      });
      setProposalData(null);
      refreshSessions(nextClient);
    } catch (error) {
      showPopup({
        message:
          error instanceof Error
            ? error.message
            : 'Could not approve this connection.',
        title: 'WalletConnect',
        variant: 'danger',
      });
    }
  }, [proposalData, refreshSessions, showPopup]);

  const rejectProposal = useCallback(async () => {
    const nextClient = clientRef.current;

    if (!nextClient || !proposalData) {
      return;
    }

    await nextClient
      .rejectSession({
        id: proposalData.id,
        reason: getSdkError('USER_REJECTED'),
      })
      .catch(() => null);
    setProposalData(null);
  }, [proposalData]);

  const removeActiveRequest = useCallback(() => {
    setRequestQueue(current => current.slice(1));
    setRequestReview(null);
    setReviewError(null);
    reviewingKeyRef.current = null;
  }, []);

  const rejectRequest = useCallback(async () => {
    const nextClient = clientRef.current;

    if (!nextClient || !activeRequestEvent) {
      return;
    }

    await nextClient
      .respondSessionRequest({
        response: formatJsonRpcError(
          activeRequestEvent.id,
          getSdkError('USER_REJECTED'),
        ),
        topic: activeRequestEvent.topic,
      })
      .catch(() => null);
    removeActiveRequest();
  }, [activeRequestEvent, removeActiveRequest]);

  const approveRequest = useCallback(async () => {
    const nextClient = clientRef.current;
    const event = activeRequestEvent;
    const currentWallet = walletRef.current;

    if (
      !nextClient ||
      !event ||
      !requestReview ||
      !currentWallet.account ||
      !currentWallet.wallet?.canSign
    ) {
      return;
    }

    const method = event.params.request.method;

    if (!isSupportedMethod(method)) {
      await respondWithError(
        nextClient,
        event,
        `Unsupported Stellar method: ${method}`,
      );
      removeActiveRequest();
      return;
    }

    try {
      if (currentWallet.isMainnet) {
        const biometrics = new ReactNativeBiometrics();
        const { available } = await biometrics.isSensorAvailable();

        if (available) {
          const { success } = await biometrics.simplePrompt({
            cancelButtonText: 'Cancel',
            promptMessage: `Approve ${requestReview.operationCount} Stellar operation${
              requestReview.operationCount === 1 ? '' : 's'
            }`,
          });

          if (!success) {
            throw new Error('Biometric confirmation was cancelled.');
          }
        }
      }

      const identityToken = await getTokenWithRetry(getIdentityToken);

      if (!identityToken) {
        throw new Error(
          'Privy session is not ready. Sign in again before approving this request.',
        );
      }

      const session = nextClient.getActiveSessions()[event.topic];
      const response = await api<WalletConnectSignResponse>(
        '/api/walletconnect/stellar/sign-xdr',
        {
          body: JSON.stringify({
            email: currentWallet.account.email,
            method,
            network: currentWallet.network,
            peerName: session?.peer.metadata.name || '',
            sourceAddress: currentWallet.wallet.address,
            sourceWalletId: currentWallet.wallet.id,
            submit: method === 'stellar_signAndSubmitXDR',
            topic: event.topic,
            xdr: extractXdr(event.params.request.params),
          }),
          headers: {
            Authorization: `Bearer ${identityToken}`,
          },
          method: 'POST',
        },
      );

      await nextClient.respondSessionRequest({
        response:
          method === 'stellar_signXDR'
            ? formatJsonRpcResult(event.id, {
                signedXDR: response.signedXdr,
              })
            : formatJsonRpcResult(event.id, {
                status: response.submitted ? 'success' : 'pending',
              }),
        topic: event.topic,
      });
      setResult({
        hash: response.hash,
        method,
        peerName: session?.peer.metadata.name || 'Connected dApp',
      });
      removeActiveRequest();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not sign this request.';
      showPopup({
        message,
        title: 'WalletConnect',
        variant: 'danger',
      });
    }
  }, [
    activeRequestEvent,
    getIdentityToken,
    removeActiveRequest,
    requestReview,
    respondWithError,
    showPopup,
  ]);

  const disconnectSession = useCallback(
    async (topic: string) => {
      const nextClient = clientRef.current;

      if (!nextClient) {
        return;
      }

      await nextClient.disconnectSession({
        reason: getSdkError('USER_DISCONNECTED'),
        topic,
      });
      refreshSessions(nextClient);
    },
    [refreshSessions],
  );

  const value = useMemo<WalletConnectContextValue>(
    () => ({
      approveProposal,
      approveRequest,
      clearResult: () => setResult(null),
      configured,
      disconnectSession,
      initializing,
      lastError,
      pair,
      pairing,
      proposal,
      rejectProposal,
      rejectRequest,
      request,
      result,
      sessions,
    }),
    [
      approveProposal,
      approveRequest,
      configured,
      disconnectSession,
      initializing,
      lastError,
      pair,
      pairing,
      proposal,
      rejectProposal,
      rejectRequest,
      request,
      result,
      sessions,
    ],
  );

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
    </WalletConnectContext.Provider>
  );
}

export function useWalletConnect() {
  const value = useContext(WalletConnectContext);

  if (!value) {
    throw new Error(
      'useWalletConnect must be used inside WalletConnectProvider',
    );
  }

  return value;
}
