export type Health = {
  ok: boolean;
  privyAppId: string | null;
  network: string;
  horizonUrl?: string;
  networks?: StellarNetworkInfo[];
  walletConnectConfigured?: boolean;
};

export type StellarNetwork = 'testnet' | 'mainnet';

export type WalletKind = 'privy' | 'watch_only' | 'imported_privy';

export type AssetTrustLevel = 'verified' | 'discovered' | 'unverified';

export type StellarNetworkInfo = {
  horizonUrl: string;
  label: string;
  network: StellarNetwork;
  supportsFriendbot: boolean;
};

export type Wallet = {
  id: string;
  address: string;
  archived?: boolean;
  canSign: boolean;
  publicKey: string;
  chainType: string;
  displayName?: string;
  kind: WalletKind;
  network: StellarNetwork;
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
  homeDomain?: string | null;
  iconKey?: string;
  isNative: boolean;
  network: StellarNetwork;
  trustLevel: AssetTrustLevel;
};

export type AssetsResponse = {
  assets: AssetItem[];
  network?: StellarNetwork;
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
  network?: StellarNetwork;
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
  network?: StellarNetwork;
  operation:
    | 'payment'
    | 'create_account'
    | 'change_trust'
    | 'path_payment_strict_send';
  sourceXlm?: string;
  destinationXlm?: string;
};

export type SessionResponse = {
  account: DemoAccount;
  activeWalletId?: string;
  balance: Balance;
  balances: BalanceItem[];
  network?: StellarNetwork;
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
  network?: StellarNetwork;
  sourceBalances: BalanceItem[];
  sourceXlm: string;
  destinationXlm: string;
  operation:
    | 'payment'
    | 'create_account'
    | 'change_trust'
    | 'path_payment_strict_send';
  transaction: TransactionItem;
  transactions: TransactionItem[];
};

export type TrustlineResult = {
  alreadyTrusted: boolean;
  balances: BalanceItem[];
  network?: StellarNetwork;
  transaction: TransactionItem | null;
  transactions: TransactionItem[];
};

export type FundAssetResult = {
  balances: BalanceItem[];
  network?: StellarNetwork;
  transaction: TransactionItem;
  transactions: TransactionItem[];
};

export type SwapQuoteResult = {
  destMin: string;
  fromAmount: string;
  fromAssetCode: string;
  fromAssetIssuer?: string | null;
  network: StellarNetwork;
  path?: unknown[];
  rate: number;
  simulated?: boolean;
  toAmount: string;
  toAssetCode: string;
  toAssetIssuer?: string | null;
};

export type SwapResult = {
  accountId: string;
  balances: BalanceItem[];
  fromAmount: string;
  fromAssetCode: string;
  hash: string;
  ledger: number;
  network?: StellarNetwork;
  rate: number;
  sourceWalletId: string;
  toAmount: string;
  toAssetCode: string;
  transaction: TransactionItem;
  transactions: TransactionItem[];
};

export type RampProvider = {
  configured: boolean;
  id: string;
  name: string;
  supports: string[];
  type: 'deposit' | 'fiat';
};

export type RampProvidersResponse = {
  providers: RampProvider[];
};

export type WalletConnectConfig = {
  configured: boolean;
  projectId: string | null;
  relays: string[];
};

export type ExportWalletResult = {
  network: StellarNetwork;
  secret: string;
  type: 'private_key' | 'seed_phrase';
};
