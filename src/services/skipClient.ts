import { SkipClient } from '@skip-go/client';
import { config, swapConfig } from '../config';
import { logger } from '../utils/logger';
import { WalletManager } from './walletManager';

export class SkipSwapService {
  private skipClient: SkipClient;
  private walletManager: WalletManager;

  constructor(walletManager: WalletManager) {
    this.walletManager = walletManager;

    const clientConfig: any = {};
    if (config.skipApiKey) {
      clientConfig.apiKey = config.skipApiKey;
      logger.info('Skip client initialized with API key');
    } else {
      logger.info('Skip client initialized without API key (using free tier)');
    }

    this.skipClient = new SkipClient(clientConfig);
  }

  async getRoute(amountIn: string) {
    try {
      logger.info('Getting swap route', {
        from: `${amountIn} ${swapConfig.sourceAsset}`,
        to: swapConfig.destAsset,
      });

      const route = await this.skipClient.route({
        sourceAssetDenom: swapConfig.sourceAsset,
        sourceAssetChainID: swapConfig.sourceChainId,
        destAssetDenom: swapConfig.destAsset,
        destAssetChainID: swapConfig.destChainId,
        amountIn,
        smartRelay: true,
        allowMultiTx: true,
        slippageTolerancePercent: (swapConfig.maxSlippage * 100).toString(),
      });

      if (!route || !route.operations || route.operations.length === 0) {
        throw new Error('No route found for swap');
      }

      const estimatedOut = route.amountOut;
      const effectiveRate = parseFloat(estimatedOut) / parseFloat(amountIn);

      logger.info('Route found', {
        estimatedOut,
        effectiveRate,
        operations: route.operations.length,
      });

      return route;
    } catch (error) {
      logger.error('Failed to get route:', error);
      throw error;
    }
  }

  async executeSwap(route: any, dryRun: boolean = false) {
    try {
      if (dryRun) {
        logger.info('DRY RUN: Would execute swap', {
          amountIn: route.amountIn,
          estimatedOut: route.amountOut,
        });
        return {
          success: true,
          dryRun: true,
          txHash: 'DRY_RUN_TX',
          amountOut: route.amountOut,
        };
      }

      logger.info('Executing swap...');

      const userAddresses = await this.getUserAddresses(route);

      const result = await this.skipClient.executeRoute({
        route,
        userAddresses,
        onTransactionCompleted: async (chainID: string, txHash: string, status: any) => {
          logger.info('Transaction completed', {
            chainID,
            txHash,
            status,
          });
        },
        onTransactionBroadcast: async (chainID: string, txHash: string) => {
          logger.info('Transaction broadcast', {
            chainID,
            txHash,
          });
        },
        getCosmosSigner: async (chainId: string) => {
          return await this.walletManager.getCosmosSignerForChain(chainId);
        },
      });

      logger.info('Swap executed successfully', result);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      logger.error('Failed to execute swap:', error);
      throw error;
    }
  }

  private async getUserAddresses(route: any): Promise<Record<string, string>> {
    const addresses: Record<string, string> = {};

    for (const chain of route.requiredChainAddresses) {
      if (chain.includes('kyve')) {
        addresses[chain] = this.walletManager.getKyveAddress();
      } else if (chain.includes('noble')) {
        addresses[chain] = this.walletManager.getNobleAddress();
      } else {
        const signer = await this.walletManager.getCosmosSignerForChain(chain);
        const accounts = await signer.getAccounts();
        addresses[chain] = accounts[0].address;
      }
    }

    logger.debug('User addresses prepared:', addresses);
    return addresses;
  }

  async getChainInfo(chainId: string) {
    try {
      const chains = await this.skipClient.chains();
      return chains.find((chain: any) => chain.chainID === chainId);
    } catch (error) {
      logger.error('Failed to get chain info:', error);
      return null;
    }
  }

  async getAssetInfo(chainId: string, denom: string) {
    try {
      const assets = await this.skipClient.assets({
        chainID: chainId,
        includeEvmAssets: false,
        includeCW20Assets: false,
      });

      return assets.find((asset: any) => asset.denom === denom);
    } catch (error) {
      logger.error('Failed to get asset info:', error);
      return null;
    }
  }

  async validateSwapPair(): Promise<boolean> {
    try {
      const [kyveChain, nobleChain] = await Promise.all([
        this.getChainInfo(swapConfig.sourceChainId),
        this.getChainInfo(swapConfig.destChainId),
      ]);

      if (!kyveChain) {
        logger.error(`Chain ${swapConfig.sourceChainId} not supported by Skip`);
        return false;
      }

      if (!nobleChain) {
        logger.error(`Chain ${swapConfig.destChainId} not supported by Skip`);
        return false;
      }

      const [kyveAsset, usdcAsset] = await Promise.all([
        this.getAssetInfo(swapConfig.sourceChainId, swapConfig.sourceAsset),
        this.getAssetInfo(swapConfig.destChainId, swapConfig.destAsset),
      ]);

      if (!kyveAsset) {
        logger.error(`Asset ${swapConfig.sourceAsset} not found on ${swapConfig.sourceChainId}`);
        return false;
      }

      if (!usdcAsset) {
        logger.error(`Asset ${swapConfig.destAsset} not found on ${swapConfig.destChainId}`);
        return false;
      }

      logger.info('Swap pair validated successfully', {
        source: `${kyveAsset.symbol} on ${kyveChain.chainName}`,
        dest: `${usdcAsset.symbol} on ${nobleChain.chainName}`,
      });

      return true;
    } catch (error) {
      logger.error('Failed to validate swap pair:', error);
      return false;
    }
  }
}