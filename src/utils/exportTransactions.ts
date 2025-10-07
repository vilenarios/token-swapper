import { TransactionLogger } from '../services/transactionLogger';
import { logger } from './logger';

async function main() {
  try {
    const transactionLogger = new TransactionLogger();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `swap_history_${timestamp}.csv`;

    const path = await transactionLogger.exportToCSV(filename);
    console.log(`✅ Transactions exported successfully to: ${path}`);

    const stats = {
      total: transactionLogger.getTransactions().length,
      successful: transactionLogger.getSuccessfulTransactions().length,
      volume: transactionLogger.getTotalVolumeUSD(),
      avgRate: transactionLogger.getAverageRate(),
    };

    console.log('\nSummary:');
    console.log(`Total Transactions: ${stats.total}`);
    console.log(`Successful: ${stats.successful}`);
    console.log(`Total Volume: $${stats.volume.toFixed(2)}`);
    console.log(`Average Rate: ${stats.avgRate.toFixed(6)}`);
  } catch (error) {
    console.error('❌ Failed to export transactions:', error);
    process.exit(1);
  }
}

main();