import dotenv from 'dotenv';
import { z } from 'zod';
import { SwapConfig, WalletConfig, NotificationConfig } from '../types';

dotenv.config();

const ConfigSchema = z.object({
  skipApiKey: z.string().optional(),
  wallet: z.object({
    mnemonic: z.string().optional(),
    privateKey: z.string().optional(),
  }).refine(data => data.mnemonic || data.privateKey, {
    message: "Either mnemonic or privateKey must be provided"
  }),
  kyve: z.object({
    rpcUrl: z.string().url(),
    chainId: z.string(),
  }),
  ethereum: z.object({
    rpcUrl: z.string().url(),
    chainId: z.string(),
    evmAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  }),
  base: z.object({
    rpcUrl: z.string().url(),
    chainId: z.string(),
    evmAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Base address"),
  }),
  swap: z.object({
    minSwapAmountUSD: z.number().positive(),
    maxSwapAmountUSD: z.number().positive(),
    swapPercentage: z.number().min(0).max(100),
    keepReserve: z.string(),
    maxSlippage: z.number(),
    minEffectiveRate: z.number(),
    schedule: z.string(),
    dryRun: z.boolean(),
    usdcDestination: z.enum(['ethereum', 'base']).default('base'),
    timeoutMinutes: z.number().positive().default(10),
  }),
  price: z.object({
    cacheDuration: z.number(),
  }),
  notification: z.object({
    discordWebhook: z.string().url().optional(),
    telegramBotToken: z.string().optional(),
    telegramChatId: z.string().optional(),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    toFile: z.boolean(),
  }),
});

function loadConfig() {
  const config = {
    skipApiKey: process.env.SKIP_API_KEY || '',
    wallet: {
      mnemonic: process.env.MNEMONIC,
      privateKey: process.env.PRIVATE_KEY,
    },
    kyve: {
      rpcUrl: process.env.KYVE_RPC_URL || 'https://rpc-eu-1.kyve.network',
      chainId: process.env.KYVE_CHAIN_ID || 'kyve-1',
    },
    ethereum: {
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      chainId: process.env.ETHEREUM_CHAIN_ID || '1',
      evmAddress: process.env.ETHEREUM_ADDRESS || '',
    },
    base: {
      rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      chainId: process.env.BASE_CHAIN_ID || '8453',
      evmAddress: process.env.ETHEREUM_BASE_ADDRESS || '',
    },
    swap: {
      minSwapAmountUSD: parseFloat(process.env.MIN_SWAP_AMOUNT_USD || '10'),
      maxSwapAmountUSD: parseFloat(process.env.MAX_SWAP_AMOUNT_USD || '1000'),
      swapPercentage: parseFloat(process.env.SWAP_PERCENTAGE || '100'),
      keepReserve: process.env.KEEP_RESERVE_KYVE || '0',
      maxSlippage: parseFloat(process.env.MAX_SLIPPAGE_PERCENT || '2') / 100,
      minEffectiveRate: parseFloat(process.env.MIN_EFFECTIVE_RATE || '0.0001'),
      schedule: process.env.SWAP_SCHEDULE || '0 0 * * *',
      dryRun: process.env.DRY_RUN === 'true',
      usdcDestination: (process.env.USDC_DESTINATION || 'base') as 'ethereum' | 'base',
      timeoutMinutes: parseFloat(process.env.SWAP_TIMEOUT_MINUTES || '10'),
    },
    price: {
      cacheDuration: parseInt(process.env.PRICE_CACHE_DURATION_MINUTES || '5'),
    },
    notification: {
      discordWebhook: process.env.DISCORD_WEBHOOK_URL,
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
    },
    logging: {
      level: (process.env.LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'debug',
      toFile: process.env.LOG_TO_FILE !== 'false',
    },
  };

  return ConfigSchema.parse(config);
}

export const config = loadConfig();

export const walletConfig: WalletConfig = {
  mnemonic: config.wallet.mnemonic,
  privateKey: config.wallet.privateKey,
  addressPrefix: 'kyve',
};

// Dynamically configure destination based on USDC_DESTINATION setting
const getDestinationConfig = () => {
  if (config.swap.usdcDestination === 'ethereum') {
    return {
      chainId: config.ethereum.chainId,
      usdcContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum L1
      address: config.ethereum.evmAddress,
    };
  } else {
    return {
      chainId: config.base.chainId,
      usdcContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base L2
      address: config.base.evmAddress,
    };
  }
};

const destConfig = getDestinationConfig();

export const swapConfig: SwapConfig = {
  minSwapAmountUSD: config.swap.minSwapAmountUSD,
  maxSwapAmountUSD: config.swap.maxSwapAmountUSD,
  swapPercentage: config.swap.swapPercentage,
  keepReserve: config.swap.keepReserve,
  maxSlippage: config.swap.maxSlippage,
  minEffectiveRate: config.swap.minEffectiveRate,
  schedule: config.swap.schedule,
  dryRun: config.swap.dryRun,
  timeoutMinutes: config.swap.timeoutMinutes,
  sourceChainId: config.kyve.chainId,
  destChainId: destConfig.chainId,
  sourceAsset: 'ukyve',
  destAsset: destConfig.usdcContract,
  destAddress: destConfig.address,
};

export const notificationConfig: NotificationConfig = {
  discordWebhook: config.notification.discordWebhook,
  telegramBotToken: config.notification.telegramBotToken,
  telegramChatId: config.notification.telegramChatId,
};