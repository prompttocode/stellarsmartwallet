export type Health = {
  ok: boolean;
  privyAppId: string | null;
  network: string;
  horizonUrl: string;
};

export type Wallet = {
  id: string;
  address: string;
  archived?: boolean;
  publicKey: string;
  chainType: string;
  displayName?: string;
};

export type DemoAccount = {
  id: string;
  activeWalletId?: string | null;
  email: string;
  wallet: Wallet;
  wallets?: Wallet[];
};

export type AssetItem = {
  assetCode: string;
  assetIssuer: string | null;
  demo: boolean;
  displayName: string;
  isNative: boolean;
};

export type AssetsResponse = {
  assets: AssetItem[];
};

export type BalanceItem = AssetItem & {
  balance: string;
  exists: boolean;
  limit?: string;
  trusted: boolean;
};

export type Balance = {
  address: string;
  balances?: BalanceItem[];
  exists: boolean;
  transactions?: TransactionItem[];
  xlm: string;
};

export type Contact = {
  id: string;
  label: string;
  funded: boolean;
  wallet: Wallet;
};

export type TransactionItem = {
  id: string;
  hash: string;
  ledger: number;
  from: string;
  to: string;
  amount: string;
  assetCode: string;
  assetIssuer: string | null;
  createdAt: string;
  direction: 'sent' | 'received' | 'trustline' | 'other';
  explorerUrl: string;
  operation: 'payment' | 'create_account' | 'change_trust';
  sourceXlm?: string;
  destinationXlm?: string;
};

export type SessionResponse = {
  account: DemoAccount;
  activeWalletId?: string;
  balance: Balance;
  balances: BalanceItem[];
  transactions: TransactionItem[];
  wallets?: Wallet[];
};

export type ReceiverResponse = {
  contact: Contact;
  balance: Balance;
};

export type SendResult = {
  assetCode: string;
  destinationBalances: BalanceItem[];
  hash: string;
  ledger: number;
  sourceBalances: BalanceItem[];
  sourceXlm: string;
  destinationXlm: string;
  operation: 'payment' | 'create_account' | 'change_trust';
  transaction: TransactionItem;
  transactions: TransactionItem[];
};

export type TrustlineResult = {
  alreadyTrusted: boolean;
  balances: BalanceItem[];
  transaction: TransactionItem | null;
  transactions: TransactionItem[];
};

export type FundAssetResult = {
  balances: BalanceItem[];
  transaction: TransactionItem;
  transactions: TransactionItem[];
};

export type SwapResult = {
  accountId: string;
  balances: BalanceItem[];
  fromAmount: string;
  fromAssetCode: string;
  hash: string;
  ledger: number;
  rate: number;
  sourceWalletId: string;
  toAmount: string;
  toAssetCode: string;
  transaction: TransactionItem;
  transactions: TransactionItem[];
};
