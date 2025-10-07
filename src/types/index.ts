export interface ChainTransaction {
  chainId: string;
  txHash: string;
  status: string;
  timestamp: string;
}

export interface SwapTransaction {
  id: string;
  timestamp: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromChainId: string;
  toChainId: string;
  kyvePrice: number;
  usdcPrice: number;
  costBasisUSD: number;
  gasFeesUSD: number;
  effectiveRate: number;
  txHash: string; // Primary transaction hash (usually the first one)
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  route?: any;
  chainTransactions?: ChainTransaction[]; // All intermediate transaction hashes
}

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: string;
  source: string;
}

export interface WalletConfig {
  mnemonic?: string;
  privateKey?: string;
  addressPrefix: string;
}

export interface SwapConfig {
  minSwapAmountUSD: number;
  maxSwapAmountUSD: number;
  swapPercentage: number;
  keepReserve: string;
  maxSlippage: number;
  minEffectiveRate: number;
  schedule: string;
  dryRun: boolean;
  timeoutMinutes: number;
  sourceChainId: string;
  destChainId: string;
  sourceAsset: string;
  destAsset: string;
  destAddress?: string;
}

export interface NotificationConfig {
  discordWebhook?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}