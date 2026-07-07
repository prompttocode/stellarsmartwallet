import type { Wallet } from '@app-types';

export type ClientStellarWalletPayload = {
  address: string;
  chain_type: string;
  id: string;
  public_key: string;
};

type PrivyLinkedEmailAccount = {
  type?: string;
  address?: string;
  chain_type?: string;
  chainType?: string;
  email?: string;
  wallet_client_type?: string;
  walletClientType?: string;
};

type PrivyUserLike = {
  id?: string;
  email?: string;
  linked_accounts?: PrivyLinkedEmailAccount[];
  linkedAccounts?: PrivyLinkedEmailAccount[];
};

export function isPrivyHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getTokenWithRetry(
  getToken: () => Promise<string | null>,
) {
  for (const delay of [0, 300, 700, 1200, 2000]) {
    if (delay > 0) {
      await wait(delay);
    }

    const token = await getToken().catch(() => null);

    if (token) {
      return token;
    }
  }

  return null;
}

export function getPrivyUserKey(userValue: unknown) {
  const currentUser = userValue as PrivyUserLike | null;

  return currentUser?.id || null;
}

function isEmailLike(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || '')
      .trim()
      .toLowerCase(),
  );
}

function getValidEmailCandidate(...values: unknown[]) {
  for (const value of values) {
    const email = String(value || '')
      .trim()
      .toLowerCase();

    if (isEmailLike(email)) {
      return email;
    }
  }

  return '';
}

export function getEmailFromPrivyUser(userValue: unknown) {
  const currentUser = userValue as PrivyUserLike | null;

  if (!currentUser) {
    return '';
  }

  const directEmail = getValidEmailCandidate(currentUser.email);

  if (directEmail) {
    return directEmail;
  }

  const linkedAccounts =
    currentUser.linked_accounts || currentUser.linkedAccounts || [];
  const emailLinkedAccount = linkedAccounts.find(account => {
    const type = String(account.type || '').toLowerCase();

    return (
      ['email', 'google', 'google_oauth', 'oauth'].includes(type) &&
      getValidEmailCandidate(account.email, account.address)
    );
  });
  const anyEmailLinkedAccount = linkedAccounts.find(account =>
    getValidEmailCandidate(account.email, account.address),
  );
  const emailAccount = emailLinkedAccount || anyEmailLinkedAccount;

  return getValidEmailCandidate(emailAccount?.email, emailAccount?.address);
}

export function hasLinkedStellarEmbeddedWallet(userValue: unknown) {
  const currentUser = userValue as PrivyUserLike | null;
  const linkedAccounts =
    currentUser?.linked_accounts || currentUser?.linkedAccounts || [];

  return linkedAccounts.some(account => {
    const type = String(account.type || '').toLowerCase();
    const chainType = String(
      account.chain_type || account.chainType || '',
    ).toLowerCase();
    const walletClientType = String(
      account.wallet_client_type || account.walletClientType || '',
    ).toLowerCase();
    const address = String(account.address || '').trim();

    return (
      type === 'wallet' &&
      (chainType === 'stellar' || address.startsWith('G')) &&
      (!walletClientType || walletClientType === 'privy')
    );
  });
}

export function walletRecordToClientPayload(
  walletValue: Wallet | null | undefined,
): ClientStellarWalletPayload | undefined {
  if (
    !walletValue ||
    walletValue.kind !== 'privy' ||
    !walletValue.id ||
    !walletValue.address
  ) {
    return undefined;
  }

  return {
    address: walletValue.address,
    chain_type: walletValue.chainType || 'stellar',
    id: walletValue.id,
    public_key: walletValue.publicKey || walletValue.address,
  };
}
