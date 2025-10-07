import { SkipClient } from '@skip-go/client';
import { config, swapConfig } from '../config';
import { logger } from '../utils/logger';
import { WalletManager } from './walletManager';

export class SkipSwapService {
  private skipClient: SkipClient;
  private walletManager: WalletManager;

  constructor(walletManager: WalletManager) {
    this.walletManager = walletManager;

    const clientConfig: any = {
      endpointOptions: {
        endpoints: {
          'kyve-1': {
            rpc: config.kyve.rpcUrl,
          },
          '1': {
            rpc: (config as any).ethereum.rpcUrl,
          },
          '8453': {
            rpc: (config as any).base.rpcUrl,
          }
        }
      }
    };

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
        allowUnsafe: true, // Allow routes with bridge fees
        smartSwapOptions: {
          slippageTolerancePercent: (swapConfig.maxSlippage * 100).toString(),
          evmSwaps: true, // Enable EVM swaps for Base L2 routing
          splitRoutes: true,
        }
      } as any);

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
    } catch (error: any) {
      logger.error(`Failed to get route: ${error.message || error}`);
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
          chainTransactions: [],
        };
      }

      logger.info('Executing swap...');

      const userAddresses = await this.getUserAddresses(route);
      const chainTransactions: Array<{ chainId: string; txHash: string; status: string; timestamp: string }> = [];
      let actualAmountOut: string | undefined;

      // Create timeout promise
      const timeoutMs = swapConfig.timeoutMinutes * 60 * 1000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Swap execution timed out after ${swapConfig.timeoutMinutes} minutes`)), timeoutMs);
      });

      // Execute route with timeout
      const executePromise = this.skipClient.executeRoute({
        route,
        userAddresses,
        onTransactionCompleted: async (txInfo: { txHash: string; chainID: string; status?: any }) => {
          console.log('\n✅ Transaction Completed');
          console.log(`   Chain: ${txInfo.chainID}`);
          console.log(`   TX Hash: ${txInfo.txHash}`);
          console.log(`   Status: ${txInfo.status || 'success'}\n`);
          logger.info('✅ Transaction completed', txInfo);

          // Update status of existing transaction or add new one
          const existing = chainTransactions.find(tx => tx.chainId === txInfo.chainID && tx.txHash === txInfo.txHash);
          if (existing) {
            existing.status = 'completed';
          } else {
            chainTransactions.push({
              chainId: txInfo.chainID,
              txHash: txInfo.txHash,
              status: 'completed',
              timestamp: new Date().toISOString(),
            });
          }
        },
        onTransactionBroadcast: async (txInfo: { txHash: string; chainID: string }) => {
          console.log('\n📡 Transaction Broadcast');
          console.log(`   Chain: ${txInfo.chainID}`);
          console.log(`   TX Hash: ${txInfo.txHash}`);
          console.log('   ⏳ Waiting for confirmation...\n');
          logger.info('📡 Transaction broadcast', txInfo);

          // Track this transaction
          chainTransactions.push({
            chainId: txInfo.chainID,
            txHash: txInfo.txHash,
            status: 'broadcast',
            timestamp: new Date().toISOString(),
          });
        },
        onTransactionTracked: async (txInfo: any) => {
          console.log('\n🔍 Transaction Tracking Update');
          console.log(`   State: ${txInfo.state || 'processing'}`);
          if (txInfo.transferSequence) {
            txInfo.transferSequence.forEach((transfer: any, idx: number) => {
              console.log(`   Step ${idx + 1}: ${transfer.from?.chainID || '?'} → ${transfer.to?.chainID || '?'} (${transfer.state || 'pending'})`);

              // Capture actual amount from final transfer
              if (transfer.state === 'success' && transfer.toAmount) {
                actualAmountOut = transfer.toAmount;
                console.log(`   💰 Final Amount: ${transfer.toAmount}`);
              }
            });
          }
          console.log('');
          logger.info('🔍 Transaction tracked', { state: txInfo.state, actualAmountOut });
        },
        getCosmosSigner: async (chainId: string) => {
          return await this.walletManager.getCosmosSignerForChain(chainId);
        },
      } as any);

      const result = await Promise.race([executePromise, timeoutPromise]);

      logger.info('Swap executed successfully', result);
      return {
        success: true,
        result,
        chainTransactions,
        amountOut: actualAmountOut || route.amountOut, // Use actual amount if available, otherwise estimated
      };
    } catch (error: any) {
      logger.error(`Failed to execute swap: ${error.message || error}`);
      throw error;
    }
  }

  private async getUserAddresses(route: any): Promise<Array<{chainID: string, address: string}>> {
    const addresses: Array<{chainID: string, address: string}> = [];

    for (const chain of route.requiredChainAddresses) {
      if (chain.includes('kyve')) {
        addresses.push({
          chainID: chain,
          address: this.walletManager.getKyveAddress()
        });
      } else if (chain === '8453') {
        // Base L2
        addresses.push({
          chainID: chain,
          address: this.walletManager.getBaseAddress()
        });
      } else if (chain === '1' || chain.includes('evm') || chain.includes('ethereum')) {
        // Ethereum L1 or other EVM chains
        addresses.push({
          chainID: chain,
          address: this.walletManager.getEthereumAddress()
        });
      } else {
        // Other Cosmos chains
        const signer = await this.walletManager.getCosmosSignerForChain(chain);
        const accounts = await signer.getAccounts();
        addresses.push({
          chainID: chain,
          address: accounts[0].address
        });
      }
    }

    logger.debug('User addresses prepared:', addresses);
    return addresses;
  }

  async getChainInfo(chainId: string) {
    try {
      const chains = await this.skipClient.chains();
      return chains.find((chain: any) => chain.chainID === chainId);
    } catch (error: any) {
      logger.error(`Failed to get chain info: ${error.message || error}`);
      return null;
    }
  }

  async getAssetInfo(chainId: string, denom: string) {
    try {
      const assetsMap = await this.skipClient.assets({
        chainID: chainId,
        includeEvmAssets: true,
        includeCW20Assets: false,
      });

      // assets returns a Record<string, Asset[]>, we need to check the chainID key
      const chainAssets = (assetsMap as any)[chainId] || [];
      return chainAssets.find((asset: any) => asset.denom === denom);
    } catch (error: any) {
      logger.error(`Failed to get asset info: ${error.message || error}`);
      return null;
    }
  }

  async validateSwapPair(): Promise<boolean> {
    try {
      // Only validate source chain (KYVE) since destination (Base L2) is EVM and won't appear in chains() list
      const kyveChain = await this.getChainInfo(swapConfig.sourceChainId);

      if (!kyveChain) {
        logger.error(`Chain ${swapConfig.sourceChainId} not supported by Skip`);
        return false;
      }

      const kyveAsset = await this.getAssetInfo(swapConfig.sourceChainId, swapConfig.sourceAsset);

      if (!kyveAsset) {
        logger.error(`Asset ${swapConfig.sourceAsset} not found on ${swapConfig.sourceChainId}`);
        return false;
      }

      logger.info('Swap pair validated successfully', {
        source: `${kyveAsset.symbol} on ${kyveChain.chainName}`,
        dest: `USDC on Base L2 (chainID: ${swapConfig.destChainId})`,
      });

      return true;
    } catch (error: any) {
      logger.error(`Failed to validate swap pair: ${error.message || error}`);
      return false;
    }
  }
}