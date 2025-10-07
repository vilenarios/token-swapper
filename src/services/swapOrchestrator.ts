import { v4 as uuidv4 } from 'uuid';
import { WalletManager } from './walletManager';
import { SkipSwapService } from './skipClient';
import { PriceService } from './priceService';
import { TransactionLogger } from './transactionLogger';
import { NotificationService } from './notificationService';
import { swapConfig } from '../config';
import { SwapTransaction } from '../types';
import { logger, logSwap } from '../utils/logger';

export class SwapOrchestrator {
  private walletManager: WalletManager;
  private skipService: SkipSwapService;
  private priceService: PriceService;
  private transactionLogger: TransactionLogger;
  private notificationService: NotificationService;
  private isRunning: boolean = false;

  constructor() {
    this.walletManager = new WalletManager();
    this.skipService = new SkipSwapService(this.walletManager);
    this.priceService = new PriceService();
    this.transactionLogger = new TransactionLogger();
    this.notificationService = new NotificationService();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Swap Orchestrator...');

    await this.walletManager.initialize();
    const isValid = await this.skipService.validateSwapPair();

    if (!isValid) {
      throw new Error('Invalid swap pair configuration');
    }

    logger.info('Swap Orchestrator initialized successfully');
  }

  async executeSwap(): Promise<SwapTransaction | null> {
    if (this.isRunning) {
      logger.warn('Swap already in progress, skipping...');
      return null;
    }

    this.isRunning = true;
    const transactionId = uuidv4();
    const startTime = new Date();

    try {
      logSwap('Starting swap execution', { id: transactionId });

      const balance = await this.walletManager.getKyveBalance();
      if (!balance || balance.amount === '0') {
        logger.warn('No KYVE balance available for swap');
        await this.notificationService.sendNotification(
          'warning',
          'No KYVE balance available for swap'
        );
        return null;
      }

      // Get current KYVE price to convert USD amounts
      const prices = await this.priceService.getPrices(['kyve', 'usdc']);
      const kyvePrice = prices.get('kyve')?.price || 0;

      if (kyvePrice === 0) {
        logger.error('Unable to fetch KYVE price, cannot determine swap amounts');
        return null;
      }

      // Convert USD amounts to KYVE amounts (in micro units)
      const minAmountMicro = (swapConfig.minSwapAmountUSD / kyvePrice) * Math.pow(10, 6);
      const maxAmountMicro = (swapConfig.maxSwapAmountUSD / kyvePrice) * Math.pow(10, 6);
      const keepReserveMicro = parseFloat(swapConfig.keepReserve) * Math.pow(10, 6);

      const balanceFloat = parseFloat(balance.amount);
      let swapAmount = balanceFloat;

      if (swapConfig.swapPercentage < 100) {
        swapAmount = Math.floor(balanceFloat * (swapConfig.swapPercentage / 100));
        logger.info(`Using ${swapConfig.swapPercentage}% of balance: ${swapAmount}`);
      }

      if (keepReserveMicro > 0) {
        swapAmount = Math.max(0, balanceFloat - keepReserveMicro);
        logger.info(`Keeping reserve of ${swapConfig.keepReserve} KYVE, swapping ${swapAmount}`);
      }

      swapAmount = Math.min(swapAmount, maxAmountMicro);

      if (swapAmount < minAmountMicro) {
        const swapAmountUSD = (swapAmount / Math.pow(10, 6)) * kyvePrice;
        logger.info(`Swap amount $${swapAmountUSD.toFixed(2)} below minimum $${swapConfig.minSwapAmountUSD}, skipping swap`);
        return null;
      }

      const usdcPrice = prices.get('usdc')?.price || 1;

      const costBasisUSD = await this.priceService.calculateCostBasis(
        swapAmount.toString(),
        'kyve'
      );

      console.log('\n🔄 SWAP STARTED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Swapping: ${this.walletManager.formatAmount(swapAmount.toString())} KYVE`);
      console.log(`💰 Cost Basis: $${costBasisUSD.toFixed(2)}`);
      console.log(`🎯 Destination: ${swapConfig.destAddress}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      logSwap('Getting swap route', {
        amount: swapAmount.toString(),
        costBasis: costBasisUSD,
      });

      console.log('🔍 Finding optimal route...');
      const route = await this.skipService.getRoute(swapAmount.toString());
      console.log('✅ Route found!\n');

      const estimatedOut = parseFloat(route.amountOut);
      const effectiveRate = estimatedOut / swapAmount;

      console.log('📈 Swap Details:');
      console.log(`   From: ${this.walletManager.formatAmount(swapAmount.toString())} KYVE`);
      console.log(`   To: ~${this.walletManager.formatAmount(estimatedOut.toString())} USDC`);
      console.log(`   Rate: ${effectiveRate.toFixed(6)} USDC per KYVE`);
      console.log(`   Slippage Tolerance: ${swapConfig.maxSlippage * 100}%\n`);

      logger.info('Swap analysis:', {
        swapAmount: this.walletManager.formatAmount(swapAmount.toString()),
        estimatedOut: this.walletManager.formatAmount(estimatedOut.toString()),
        effectiveRate: effectiveRate.toFixed(6),
        slippageTolerance: `${swapConfig.maxSlippage * 100}%`
      });

      if (effectiveRate < swapConfig.minEffectiveRate) {
        logger.warn(`Effective rate ${effectiveRate} below minimum ${swapConfig.minEffectiveRate}, cancelling swap`);
        await this.notificationService.sendNotification(
          'warning',
          `Swap cancelled: Rate too low (${effectiveRate.toFixed(6)} < ${swapConfig.minEffectiveRate})`
        );
        return null;
      }

      logSwap('Executing swap', {
        estimatedOut: route.amountOut,
        dryRun: swapConfig.dryRun,
      });

      console.log('🚀 Executing cross-chain swap...\n');
      const result = await this.skipService.executeSwap(route, swapConfig.dryRun);
      console.log('\n✨ Swap execution completed!\n');

      // Extract primary tx hash from chainTransactions or result
      const primaryTxHash = result.chainTransactions && result.chainTransactions.length > 0
        ? result.chainTransactions[0].txHash
        : (result.txHash || 'PENDING');

      const transaction: SwapTransaction = {
        id: transactionId,
        timestamp: startTime.toISOString(),
        fromToken: 'KYVE',
        toToken: 'USDC',
        fromAmount: swapAmount.toString(),
        toAmount: result.amountOut || route.amountOut,
        fromChainId: swapConfig.sourceChainId,
        toChainId: swapConfig.destChainId,
        kyvePrice,
        usdcPrice,
        costBasisUSD,
        gasFeesUSD: 0,
        effectiveRate: parseFloat(result.amountOut || route.amountOut) / swapAmount,
        txHash: primaryTxHash,
        status: result.success ? 'completed' : 'failed',
        chainTransactions: result.chainTransactions || [],
        // Don't store route - it contains circular HTTP objects
      };

      await this.transactionLogger.logTransaction(transaction);

      const message = `Swap completed: ${this.walletManager.formatAmount(swapAmount.toString())} KYVE → ${this.walletManager.formatAmount(transaction.toAmount)} USDC (Cost basis: $${costBasisUSD.toFixed(2)})`;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 SWAP SUCCESSFUL!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ Sent: ${this.walletManager.formatAmount(swapAmount.toString())} KYVE`);
      console.log(`✅ Received: ${this.walletManager.formatAmount(transaction.toAmount)} USDC`);
      console.log(`💰 Cost Basis: $${costBasisUSD.toFixed(2)}`);
      console.log(`🔗 TX Hash: ${transaction.txHash}`);
      console.log(`📍 Destination: ${swapConfig.destAddress}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      logSwap(message, { transaction });
      await this.notificationService.sendNotification('success', message, transaction);

      return transaction;
    } catch (error: any) {
      const transaction: SwapTransaction = {
        id: transactionId,
        timestamp: startTime.toISOString(),
        fromToken: 'KYVE',
        toToken: 'USDC',
        fromAmount: '0',
        toAmount: '0',
        fromChainId: swapConfig.sourceChainId,
        toChainId: swapConfig.destChainId,
        kyvePrice: 0,
        usdcPrice: 0,
        costBasisUSD: 0,
        gasFeesUSD: 0,
        effectiveRate: 0,
        txHash: '',
        status: 'failed',
        error: error.message,
      };

      await this.transactionLogger.logTransaction(transaction);

      // Log error to console to avoid circular JSON issues
      console.error('Swap failed - actual error:', error);
      logger.error(`Swap failed: ${String(error.message || error)}`);
      await this.notificationService.sendNotification(
        'error',
        `Swap failed: ${error.message}`,
        transaction
      );

      return transaction;
    } finally {
      this.isRunning = false;
    }
  }

  async getStatus(): Promise<any> {
    const balances = await this.walletManager.getAllBalances();
    const stats = {
      totalTransactions: this.transactionLogger.getTransactions().length,
      successfulTransactions: this.transactionLogger.getSuccessfulTransactions().length,
      totalVolumeUSD: this.transactionLogger.getTotalVolumeUSD(),
      averageRate: this.transactionLogger.getAverageRate(),
    };

    return {
      isRunning: this.isRunning,
      walletAddresses: {
        kyve: this.walletManager.getKyveAddress(),
        ethereum: this.walletManager.getEthereumAddress(),
        base: this.walletManager.getBaseAddress(),
      },
      balances: {
        kyve: balances.kyve ? this.walletManager.formatAmount(balances.kyve.amount) : '0',
        usdc: balances.usdc ? this.walletManager.formatAmount(balances.usdc.amount) : '0',
      },
      statistics: stats,
      config: {
        minSwapAmountUSD: swapConfig.minSwapAmountUSD,
        maxSwapAmountUSD: swapConfig.maxSwapAmountUSD,
        maxSlippage: swapConfig.maxSlippage,
        schedule: swapConfig.schedule,
        dryRun: swapConfig.dryRun,
        timeoutMinutes: swapConfig.timeoutMinutes,
        destination: swapConfig.destChainId === '8453' ? 'Base L2' : 'Ethereum L1',
        destinationAddress: swapConfig.destAddress,
      },
    };
  }

  async exportTransactions(filename?: string): Promise<string> {
    return await this.transactionLogger.exportToCSV(filename);
  }
}