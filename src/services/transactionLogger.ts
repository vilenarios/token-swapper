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
        logger.error('Failed to load transactions:', error);
      }
    }
  }

  private async saveTransactions(): Promise<void> {
    try {
      await fs.writeFile(
        TRANSACTIONS_FILE,
        JSON.stringify(this.transactions, null, 2),
        'utf-8'
      );
      logger.debug('Transactions saved to file');
    } catch (error) {
      logger.error('Failed to save transactions:', error);
    }
  }

  async logTransaction(transaction: SwapTransaction): Promise<void> {
    this.transactions.push(transaction);
    await this.saveTransactions();
    await this.appendToCSV(transaction);

    logger.info('Transaction logged:', {
      id: transaction.id,
      from: `${transaction.fromAmount} ${transaction.fromToken}`,
      to: `${transaction.toAmount} ${transaction.toToken}`,
      costBasis: `$${transaction.costBasisUSD.toFixed(2)}`,
      status: transaction.status
    });
  }

  private async appendToCSV(transaction: SwapTransaction): Promise<void> {
    try {
      const csvRecord = {
        ...transaction,
        kyvePrice: transaction.kyvePrice.toFixed(6),
        usdcPrice: transaction.usdcPrice.toFixed(4),
        costBasisUSD: transaction.costBasisUSD.toFixed(2),
        gasFeesUSD: transaction.gasFeesUSD.toFixed(4),
        effectiveRate: transaction.effectiveRate.toFixed(6)
      };

      await this.csvWriter.writeRecords([csvRecord]);
      logger.debug('Transaction appended to CSV');
    } catch (error) {
      logger.error('Failed to append to CSV:', error);
    }
  }

  async exportToCSV(filename?: string): Promise<string> {
    const exportPath = filename ? path.join(DATA_DIR, filename) : CSV_FILE;

    try {
      const writer = createObjectCsvWriter({
        path: exportPath,
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
        ]
      });

      const records = this.transactions.map(tx => ({
        ...tx,
        kyvePrice: tx.kyvePrice.toFixed(6),
        usdcPrice: tx.usdcPrice.toFixed(4),
        costBasisUSD: tx.costBasisUSD.toFixed(2),
        gasFeesUSD: tx.gasFeesUSD.toFixed(4),
        effectiveRate: tx.effectiveRate.toFixed(6)
      }));

      await writer.writeRecords(records);
      logger.info(`Exported ${records.length} transactions to ${exportPath}`);
      return exportPath;
    } catch (error) {
      logger.error('Failed to export to CSV:', error);
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