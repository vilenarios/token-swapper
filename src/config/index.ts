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
  noble: z.object({
    rpcUrl: z.string().url(),
    chainId: z.string(),
  }),
  swap: z.object({
    minSwapAmount: z.string(),
    maxSwapAmount: z.string(),
    swapPercentage: z.number().min(0).max(100),
    keepReserve: z.string(),
    maxSlippage: z.number(),
    minEffectiveRate: z.number(),
    schedule: z.string(),
    dryRun: z.boolean(),
  }),
  price: z.object({
    coingeckoApiKey: z.string().optional(),
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
    noble: {
      rpcUrl: process.env.NOBLE_RPC_URL || 'https://noble-rpc.polkachu.com',
      chainId: process.env.NOBLE_CHAIN_ID || 'noble-1',
    },
    swap: {
      minSwapAmount: process.env.MIN_SWAP_AMOUNT_KYVE || '100',
      maxSwapAmount: process.env.MAX_SWAP_AMOUNT_KYVE || '1000000',
      swapPercentage: parseFloat(process.env.SWAP_PERCENTAGE || '100'),
      keepReserve: process.env.KEEP_RESERVE_KYVE || '0',
      maxSlippage: parseFloat(process.env.MAX_SLIPPAGE_PERCENT || '2') / 100,
      minEffectiveRate: parseFloat(process.env.MIN_EFFECTIVE_RATE || '0.0001'),
      schedule: process.env.SWAP_SCHEDULE || '0 */6 * * *',
      dryRun: process.env.DRY_RUN === 'true',
    },
    price: {
      coingeckoApiKey: process.env.COINGECKO_API_KEY,
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

export const swapConfig: SwapConfig = {
  minSwapAmount: config.swap.minSwapAmount,
  maxSwapAmount: config.swap.maxSwapAmount,
  swapPercentage: config.swap.swapPercentage,
  keepReserve: config.swap.keepReserve,
  maxSlippage: config.swap.maxSlippage,
  minEffectiveRate: config.swap.minEffectiveRate,
  schedule: config.swap.schedule,
  dryRun: config.swap.dryRun,
  sourceChainId: config.kyve.chainId,
  destChainId: config.noble.chainId,
  sourceAsset: 'ukyve',
  destAsset: 'uusdc',
};

export const notificationConfig: NotificationConfig = {
  discordWebhook: config.notification.discordWebhook,
  telegramBotToken: config.notification.telegramBotToken,
  telegramChatId: config.notification.telegramChatId,
};