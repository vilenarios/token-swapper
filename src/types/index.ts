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
  txHash: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  route?: any;
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
  minSwapAmount: string;
  maxSwapAmount: string;
  swapPercentage: number;
  keepReserve: string;
  maxSlippage: number;
  minEffectiveRate: number;
  schedule: string;
  dryRun: boolean;
  sourceChainId: string;
  destChainId: string;
  sourceAsset: string;
  destAsset: string;
}

export interface NotificationConfig {
  discordWebhook?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}