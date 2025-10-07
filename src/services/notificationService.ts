import axios from 'axios';
import { notificationConfig } from '../config';
import { SwapTransaction } from '../types';
import { logger } from '../utils/logger';

export class NotificationService {
  async sendNotification(
    type: 'success' | 'error' | 'warning',
    message: string,
    transaction?: SwapTransaction
  ): Promise<void> {
    const promises = [];

    if (notificationConfig.discordWebhook) {
      promises.push(this.sendDiscordNotification(type, message, transaction));
    }

    if (notificationConfig.telegramBotToken && notificationConfig.telegramChatId) {
      promises.push(this.sendTelegramNotification(type, message, transaction));
    }

    await Promise.allSettled(promises);
  }

  private async sendDiscordNotification(
    type: 'success' | 'error' | 'warning',
    message: string,
    transaction?: SwapTransaction
  ): Promise<void> {
    try {
      const color = type === 'success' ? 0x00ff00 : type === 'error' ? 0xff0000 : 0xffaa00;

      const embed: any = {
        title: `KYVE Swapper - ${type.toUpperCase()}`,
        description: message,
        color,
        timestamp: new Date().toISOString(),
      };

      if (transaction) {
        embed.fields = [
          {
            name: 'From',
            value: `${transaction.fromAmount} ${transaction.fromToken}`,
            inline: true,
          },
          {
            name: 'To',
            value: `${transaction.toAmount} ${transaction.toToken}`,
            inline: true,
          },
          {
            name: 'Cost Basis',
            value: `$${transaction.costBasisUSD.toFixed(2)}`,
            inline: true,
          },
          {
            name: 'Status',
            value: transaction.status,
            inline: true,
          },
          {
            name: 'TX Hash',
            value: transaction.txHash || 'N/A',
            inline: false,
          },
        ];
      }

      await axios.post(notificationConfig.discordWebhook!, {
        embeds: [embed],
      });

      logger.debug('Discord notification sent');
    } catch (error) {
      logger.error('Failed to send Discord notification:', error);
    }
  }

  private async sendTelegramNotification(
    type: 'success' | 'error' | 'warning',
    message: string,
    transaction?: SwapTransaction
  ): Promise<void> {
    try {
      const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
      let text = `${emoji} *KYVE Swapper ${type.toUpperCase()}*\n\n${message}`;

      if (transaction) {
        text += '\n\n';
        text += `*From:* ${transaction.fromAmount} ${transaction.fromToken}\n`;
        text += `*To:* ${transaction.toAmount} ${transaction.toToken}\n`;
        text += `*Cost Basis:* $${transaction.costBasisUSD.toFixed(2)}\n`;
        text += `*Status:* ${transaction.status}\n`;
        if (transaction.txHash) {
          text += `*TX Hash:* \`${transaction.txHash}\``;
        }
      }

      const url = `https://api.telegram.org/bot${notificationConfig.telegramBotToken}/sendMessage`;
      await axios.post(url, {
        chat_id: notificationConfig.telegramChatId,
        text,
        parse_mode: 'Markdown',
      });

      logger.debug('Telegram notification sent');
    } catch (error) {
      logger.error('Failed to send Telegram notification:', error);
    }
  }

  async sendDailySummary(stats: any): Promise<void> {
    const message = `Daily Summary:\n` +
      `Total Transactions: ${stats.totalTransactions}\n` +
      `Successful: ${stats.successfulTransactions}\n` +
      `Total Volume: $${stats.totalVolumeUSD.toFixed(2)}\n` +
      `Average Rate: ${stats.averageRate.toFixed(6)}`;

    await this.sendNotification('success', message);
  }
}