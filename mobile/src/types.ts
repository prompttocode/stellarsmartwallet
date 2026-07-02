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
  archivedAt?: string;
  canSign: boolean;
  publicKey: string;
  chainType: string;
  displayName?: string;
  kind: WalletKind;
  network: StellarNetwork;
};

export type WalletAccount = {
  id: string;
  activeWalletId?: string | null;
  email: string;
  wallet: Wallet;
  wallets?: Wallet[];
};

export type KycStatus = 'not_started' | 'verified';

export type KycSummary = {
  cccdLast4?: string;
  fullName?: string;
  phone?: string;
  providerUserId?: string;
  status: KycStatus;
  verifiedAt?: string;
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
  priceUsd?: number | null;
  rating?: number | null;
  trustLevel: AssetTrustLevel;
  volume7d?: number | null;
  image?: string | null;
};

export type AssetsResponse = {
  assets: AssetItem[];
  network?: StellarNetwork;
};

export type FavoriteAsset = AssetItem & {
  createdAt: string;
  id: string;
  updatedAt: string;
};

export type FavoriteAssetsResponse = {
  data: {
    asset?: FavoriteAsset | null;
    assets?: FavoriteAsset[];
    deleted?: boolean;
  };
  success: boolean;
};

export type CollectibleItem = AssetItem & {
  balance: string;
  claimed: boolean;
  description: string;
  explorerUrl: string | null;
  id: string;
  supply: string;
};

export type CollectiblesResponse = {
  collectibles: CollectibleItem[];
  network?: StellarNetwork;
};

export type BalanceItem = AssetItem & {
  availableBalance?: string;
  balance: string;
  exists: boolean;
  limit?: string;
  minimumBalance?: string;
  reservedBalance?: string;
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
  feeChargedStroops?: string | null;
  feeChargedXlm?: string | null;
  maxFeeStroops?: string | null;
  maxFeeXlm?: string | null;
  network?: StellarNetwork;
  operationCount?: number | null;
  operation:
    | 'payment'
    | 'create_account'
    | 'change_trust'
    | 'path_payment_strict_send';
  sourceXlm?: string;
  destinationXlm?: string;
};

export type SessionResponse = {
  account: WalletAccount;
  activeWalletId?: string;
  balance: Balance;
  balances: BalanceItem[];
  kyc?: KycSummary;
  network?: StellarNetwork;
  transactions: TransactionItem[];
  wallets?: Wallet[];
};

export type ArchivedWalletsResponse = {
  network?: StellarNetwork;
  wallets: Wallet[];
};

export type TransactionHistoryResponse = {
  address: string;
  network?: StellarNetwork;
  transactions: TransactionItem[];
};

export type KycApiResponse = RampApiResponse<KycSummary>;

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
  requiresClientSignature?: boolean;
  sourceBalances: BalanceItem[];
  sourceXlm: string;
  destinationXlm: string;
  operation:
    | 'payment'
    | 'create_account'
    | 'change_trust'
    | 'path_payment_strict_send';
  transaction: TransactionItem;
  transactionXdr?: string;
  transactions: TransactionItem[];
};

export type TrustlineResult = {
  alreadyTrusted: boolean;
  balances: BalanceItem[];
  hash?: `0x${string}`;
  network?: StellarNetwork;
  requiresClientSignature?: boolean;
  transaction: TransactionItem | null;
  transactionXdr?: string;
  transactions: TransactionItem[];
};

export type FundNftResult = {
  alreadyClaimed: boolean;
  balances: BalanceItem[];
  collectibles: CollectibleItem[];
  hash?: `0x${string}`;
  network?: StellarNetwork;
  requiresClientSignature?: boolean;
  transaction: TransactionItem | null;
  transactionXdr?: string;
  transactions: TransactionItem[];
  trustlineTransaction?: TransactionItem | null;
};

export type SwapQuoteResult = {
  destMin: string;
  feeEstimateStroops?: string | null;
  feeEstimateXlm?: string | null;
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
  feeEstimateStroops?: string | null;
  feeEstimateXlm?: string | null;
  fromAmount: string;
  fromAssetCode: string;
  hash: string;
  ledger: number;
  network?: StellarNetwork;
  rate: number;
  requiresClientSignature?: boolean;
  sourceWalletId: string;
  toAmount: string;
  toAssetCode: string;
  transaction: TransactionItem;
  transactionXdr?: string;
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

export type RampDirection = 'buy' | 'sell';
export type RampAssetCode = 'XLM' | 'USDC';

export type RampQuote = {
  amount: string;
  asset_code: RampAssetCode;
  created_at: string;
  direction: RampDirection;
  fee_rate: number;
  fee_vnd: number;
  gross_vnd: number;
  max_order_amount: number | null;
  min_fee_vnd: number;
  min_order_amount: number;
  rate: number;
  source: string;
  total_vnd: number;
};

export type RampBankInfo = {
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
  transferContent: string;
  vaAmount: number;
};

export type RampTimestamp =
  | string
  | {
      nanos?: number;
      seconds: number;
    };

export type RampOrder = {
  amount: number | string;
  asset_code: RampAssetCode;
  body?: {
    bankInfo?: RampBankInfo;
    qr_link?: string;
  };
  chain_id: number;
  code: string;
  created_at?: RampTimestamp;
  currency?: string;
  expired_at?: RampTimestamp;
  id: string;
  order_type: RampDirection;
  pay_data?: {
    address?: string;
  };
  payment_info?: {
    account_number?: string;
    account_type?: number;
    bank_account_name?: string;
    bank_account_no?: string;
    bank_id?: string;
    full_name?: string;
  };
  processing_state: number;
  provider?: string;
  rate?: number;
  sell_transaction_hash?: string;
  state: number;
  token_address?: string;
  total_fee_vnd?: number;
  transaction_hash?: string | null;
};

export type RampApiResponse<T> = {
  data: T;
  success: boolean;
};

export type RampOrderHistoryResponse = RampApiResponse<{
  orders: RampOrder[];
}>;

export type RampPaymentInfo = {
  accountNumber: string;
  accountType: 0 | 1 | 2;
  bankId: string;
  fullName: string;
};

export type RampPaymentMethod = RampPaymentInfo & {
  bankName: string;
  createdAt: string;
  id: string;
  isDefault: boolean;
  updatedAt: string;
};

export type RampPaymentMethodsResponse = RampApiResponse<{
  method?: RampPaymentMethod;
  methods?: RampPaymentMethod[];
}>;

export type WalletConnectConfig = {
  configured: boolean;
  projectId: string | null;
  relays: string[];
};

export type ExportWalletResult = {
  address: string;
  network: StellarNetwork;
  secret: string;
  type: 'private_key';
};
