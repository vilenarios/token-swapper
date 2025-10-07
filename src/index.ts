import cron from 'node-cron';
import { SwapOrchestrator } from './services/swapOrchestrator';
import { swapConfig } from './config';
import { logger } from './utils/logger';

class KyveSwapperBot {
  private orchestrator: SwapOrchestrator;
  private cronJob: cron.ScheduledTask | null = null;

  constructor() {
    this.orchestrator = new SwapOrchestrator();
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting KYVE Swapper Bot...');

      await this.orchestrator.initialize();

      const status = await this.orchestrator.getStatus();
      logger.info('Bot Status:', status);

      if (swapConfig.dryRun) {
        logger.warn('DRY RUN MODE ENABLED - No real transactions will be executed');
      }

      this.setupScheduler();

      logger.info('Executing initial swap check...');
      await this.orchestrator.executeSwap();

      logger.info(`Bot started successfully. Schedule: ${swapConfig.schedule}`);

      this.setupShutdownHandlers();

    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private setupScheduler(): void {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    this.cronJob = cron.schedule(swapConfig.schedule, async () => {
      logger.info('Scheduled swap execution started');
      await this.orchestrator.executeSwap();
    });

    this.cronJob.start();
    logger.info(`Scheduler started with cron pattern: ${swapConfig.schedule}`);
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      if (this.cronJob) {
        this.cronJob.stop();
      }

      const csvPath = await this.orchestrator.exportTransactions();
      logger.info(`Final transactions exported to: ${csvPath}`);

      const status = await this.orchestrator.getStatus();
      logger.info('Final Status:', status);

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async runOnce(): Promise<void> {
    try {
      logger.info('Running single swap execution...');
      await this.orchestrator.initialize();

      const result = await this.orchestrator.executeSwap();
      if (result) {
        logger.info('Swap completed:', result);
      } else {
        logger.info('No swap executed (conditions not met)');
      }

      const csvPath = await this.orchestrator.exportTransactions();
      logger.info(`Transactions exported to: ${csvPath}`);

      process.exit(0);
    } catch (error) {
      logger.error('Failed to execute swap:', error);
      process.exit(1);
    }
  }

  async exportHistory(): Promise<void> {
    try {
      await this.orchestrator.initialize();
      const csvPath = await this.orchestrator.exportTransactions();
      logger.info(`Transaction history exported to: ${csvPath}`);

      const status = await this.orchestrator.getStatus();
      console.log('\nBot Statistics:');
      console.log('================');
      console.log(`Total Transactions: ${status.statistics.totalTransactions}`);
      console.log(`Successful: ${status.statistics.successfulTransactions}`);
      console.log(`Total Volume (USD): $${status.statistics.totalVolumeUSD.toFixed(2)}`);
      console.log(`Average Rate: ${status.statistics.averageRate.toFixed(6)}`);

      process.exit(0);
    } catch (error) {
      logger.error('Failed to export history:', error);
      process.exit(1);
    }
  }

  async getStatus(): Promise<void> {
    try {
      await this.orchestrator.initialize();
      const status = await this.orchestrator.getStatus();

      console.log('\nKYVE Swapper Bot Status');
      console.log('======================');
      console.log('\nWallet Addresses:');
      console.log(`  KYVE: ${status.walletAddresses.kyve}`);
      console.log(`  Ethereum L1: ${status.walletAddresses.ethereum}`);
      console.log(`  Base L2: ${status.walletAddresses.base}`);
      console.log('\nBalances:');
      console.log(`  KYVE: ${status.balances.kyve}`);
      console.log(`  USDC: ${status.balances.usdc}`);
      console.log('\nStatistics:');
      console.log(`  Total Transactions: ${status.statistics.totalTransactions}`);
      console.log(`  Successful: ${status.statistics.successfulTransactions}`);
      console.log(`  Total Volume (USD): $${status.statistics.totalVolumeUSD.toFixed(2)}`);
      console.log(`  Average Rate: ${status.statistics.averageRate.toFixed(6)}`);
      console.log('\nConfiguration:');
      console.log(`  Min Swap Amount: $${status.config.minSwapAmountUSD}`);
      console.log(`  Max Swap Amount: $${status.config.maxSwapAmountUSD}`);
      console.log(`  Max Slippage: ${status.config.maxSlippage * 100}%`);
      console.log(`  Schedule: ${status.config.schedule}`);
      console.log(`  Timeout: ${status.config.timeoutMinutes} minutes`);
      console.log(`  Dry Run: ${status.config.dryRun}`);
      console.log(`  USDC Destination: ${status.config.destination}`);
      console.log(`  Destination Address: ${status.config.destinationAddress}`);

      process.exit(0);
    } catch (error) {
      logger.error('Failed to get status:', error);
      process.exit(1);
    }
  }
}

const bot = new KyveSwapperBot();

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'once':
    bot.runOnce();
    break;
  case 'export':
    bot.exportHistory();
    break;
  case 'status':
    bot.getStatus();
    break;
  default:
    bot.start();
}