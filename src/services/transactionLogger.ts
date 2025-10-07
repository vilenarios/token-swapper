import fs from 'fs/promises';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { SwapTransaction } from '../types';
import { logger } from '../utils/logger';

const DATA_DIR = path.join(process.cwd(), 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const CSV_FILE = path.join(DATA_DIR, 'swap_history.csv');

export class TransactionLogger {
  private transactions: SwapTransaction[] = [];
  private csvWriter;

  constructor() {
    this.csvWriter = createObjectCsvWriter({
      path: CSV_FILE,
      header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'id', title: 'Transaction ID' },
        { id: 'fromToken', title: 'From Token' },
        { id: 'toToken', title: 'To Token' },
        { id: 'fromAmount', title: 'From Amount' },
        { id: 'toAmount', title: 'To Amount' },
        { id: 'kyvePrice', title: 'KYVE Price (USD)' },
        { id: 'usdcPrice', title: 'USDC Price (USD)' },
        { id: 'costBasisUSD', title: 'Cost Basis (USD)' },
        { id: 'gasFeesUSD', title: 'Gas Fees (USD)' },
        { id: 'effectiveRate', title: 'Effective Rate' },
        { id: 'fromChainId', title: 'From Chain' },
        { id: 'toChainId', title: 'To Chain' },
        { id: 'txHash', title: 'Transaction Hash' },
        { id: 'status', title: 'Status' },
        { id: 'error', title: 'Error Message' }
      ],
      append: true
    });
    this.loadTransactions();
  }

  private async loadTransactions(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });

      const data = await fs.readFile(TRANSACTIONS_FILE, 'utf-8');
      this.transactions = JSON.parse(data);
      logger.info(`Loaded ${this.transactions.length} transactions from file`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.info('No existing transactions file found, starting fresh');
        this.transactions = [];
        await this.saveTransactions();
      } else {
        logger.error(`Failed to load transactions: ${(error as any).message || error}`);
      }
    }
  }

  private async saveTransactions(): Promise<void> {
    try {
      // Remove route field to avoid circular references
      const cleanTransactions = this.transactions.map(t => {
        const { route, ...clean } = t;
        return clean;
      });

      await fs.writeFile(
        TRANSACTIONS_FILE,
        JSON.stringify(cleanTransactions, null, 2),
        'utf-8'
      );
      logger.debug('Transactions saved to file');
    } catch (error: any) {
      logger.error(`Failed to save transactions: ${error.message || error}`);
    }
  }

  async logTransaction(transaction: SwapTransaction): Promise<void> {
    this.transactions.push(transaction);
    await this.saveTransactions();
    await this.appendToCSV(transaction);

    const logData: any = {
      id: transaction.id,
      from: `${transaction.fromAmount} ${transaction.fromToken}`,
      to: `${transaction.toAmount} ${transaction.toToken}`,
      costBasis: `$${transaction.costBasisUSD.toFixed(2)}`,
      status: transaction.status
    };

    if (transaction.chainTransactions && transaction.chainTransactions.length > 0) {
      logData.chainTxs = transaction.chainTransactions
        .filter(tx => tx.txHash) // Only include transactions with valid txHash
        .map(tx => `${tx.chainId || '?'}:${tx.txHash.substring(0, 8)}...`)
        .join(', ');
    }

    logger.info('Transaction logged:', logData);
  }

  private async appendToCSV(transaction: SwapTransaction): Promise<void> {
    try {
      // Don't spread transaction - it may contain route with circular references
      const csvRecord = {
        Timestamp: transaction.timestamp,
        'Transaction ID': transaction.id,
        'From Token': transaction.fromToken,
        'To Token': transaction.toToken,
        'From Amount': (parseFloat(transaction.fromAmount) / 1000000).toFixed(6),
        'To Amount': (parseFloat(transaction.toAmount) / 1000000).toFixed(6),
        'KYVE Price (USD)': transaction.kyvePrice.toFixed(6),
        'USDC Price (USD)': transaction.usdcPrice.toFixed(4),
        'Cost Basis (USD)': transaction.costBasisUSD.toFixed(2),
        'Gas Fees (USD)': transaction.gasFeesUSD.toFixed(4),
        'Effective Rate': transaction.effectiveRate.toFixed(6),
        'From Chain': transaction.fromChainId,
        'To Chain': transaction.toChainId,
        'Transaction Hash': transaction.txHash,
        Status: transaction.status,
        'Error Message': transaction.error || '',
      };

      await this.csvWriter.writeRecords([csvRecord]);
      logger.debug('Transaction appended to CSV');
    } catch (error: any) {
      logger.error(`Failed to append to CSV: ${error.message || error}`);
    }
  }

  async exportToCSV(filename?: string): Promise<string> {
    const exportPath = filename ? path.join(DATA_DIR, filename) : CSV_FILE;

    try {
      const writer = createObjectCsvWriter({
        path: exportPath,
        header: [
          { id: 'date', title: 'Date' },
          { id: 'sentAmount', title: 'Sent Amount' },
          { id: 'sentCurrency', title: 'Sent Currency' },
          { id: 'receivedAmount', title: 'Received Amount' },
          { id: 'receivedCurrency', title: 'Received Currency' },
          { id: 'feeAmount', title: 'Fee Amount' },
          { id: 'feeCurrency', title: 'Fee Currency' },
          { id: 'netWorthAmount', title: 'Net Worth Amount' },
          { id: 'netWorthCurrency', title: 'Net Worth Currency' },
          { id: 'label', title: 'Label' },
          { id: 'description', title: 'Description' },
          { id: 'txHash', title: 'TxHash' },
          { id: 'chainTransactions', title: 'Chain Transactions' }
        ]
      });

      const records = this.transactions
        .filter(tx => tx.status === 'completed') // Only export successful swaps
        .map(tx => {
          // Determine destination chain name
          const destChainName = tx.toChainId === '8453' ? 'Base L2' :
                               tx.toChainId === '1' ? 'Ethereum L1' :
                               `Chain ${tx.toChainId}`;

          // Format chain transactions for CSV
          const chainTxs = tx.chainTransactions && tx.chainTransactions.length > 0
            ? tx.chainTransactions
                .filter(ctx => ctx.txHash)
                .map(ctx => `${ctx.chainId}:${ctx.txHash}`)
                .join(' | ')
            : tx.txHash;

          return {
            date: new Date(tx.timestamp).toISOString().split('T')[0], // YYYY-MM-DD format
            sentAmount: (parseFloat(tx.fromAmount) / 1000000).toFixed(6),
            sentCurrency: tx.fromToken,
            receivedAmount: (parseFloat(tx.toAmount) / 1000000).toFixed(6),
            receivedCurrency: tx.toToken,
            feeAmount: tx.gasFeesUSD.toFixed(4),
            feeCurrency: 'USD',
            netWorthAmount: tx.costBasisUSD.toFixed(2),
            netWorthCurrency: 'USD',
            label: 'Crypto Swap',
            description: `Swapped ${tx.fromToken} to ${tx.toToken} on ${destChainName} via Skip Protocol`,
            txHash: tx.txHash,
            chainTransactions: chainTxs
          };
        });

      await writer.writeRecords(records);
      logger.info(`Exported ${records.length} transactions to ${exportPath}`);
      return exportPath;
    } catch (error: any) {
      logger.error(`Failed to export to CSV: ${error.message || error}`);
      throw error;
    }
  }

  getTransactions(): SwapTransaction[] {
    return this.transactions;
  }

  getSuccessfulTransactions(): SwapTransaction[] {
    return this.transactions.filter(tx => tx.status === 'completed');
  }

  getTotalVolumeUSD(): number {
    return this.getSuccessfulTransactions().reduce(
      (sum, tx) => sum + tx.costBasisUSD,
      0
    );
  }

  getAverageRate(): number {
    const successful = this.getSuccessfulTransactions();
    if (successful.length === 0) return 0;

    const totalRate = successful.reduce((sum, tx) => sum + tx.effectiveRate, 0);
    return totalRate / successful.length;
  }
}