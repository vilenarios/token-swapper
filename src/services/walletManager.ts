import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { SigningStargateClient, StargateClient } from '@cosmjs/stargate';
import { Coin } from '@cosmjs/amino';
import { walletConfig, config } from '../config';
import { logger } from '../utils/logger';

export class WalletManager {
  private wallet: DirectSecp256k1HdWallet | DirectSecp256k1Wallet | null = null;
  private kyveClient: SigningStargateClient | null = null;
  private kyveAddress: string = '';
  private ethereumAddress: string = '';
  private baseAddress: string = '';

  async initialize(): Promise<void> {
    try {
      if (walletConfig.mnemonic) {
        this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(walletConfig.mnemonic, {
          prefix: 'kyve',
        });
        logger.info('Wallet initialized from mnemonic');
      } else if (walletConfig.privateKey) {
        const privateKey = Buffer.from(walletConfig.privateKey, 'hex');
        this.wallet = await DirectSecp256k1Wallet.fromKey(privateKey, 'kyve');
        logger.info('Wallet initialized from private key');
      } else {
        throw new Error('No wallet credentials provided');
      }

      const accounts = await this.wallet.getAccounts();
      this.kyveAddress = accounts[0].address;

      // Get Ethereum and Base addresses from config (user must provide their EVM addresses)
      this.ethereumAddress = (config as any).ethereum.evmAddress;
      this.baseAddress = (config as any).base.evmAddress;

      this.kyveClient = await SigningStargateClient.connectWithSigner(
        config.kyve.rpcUrl,
        this.wallet
      );

      logger.info('Wallet manager initialized', {
        kyveAddress: this.kyveAddress,
        ethereumAddress: this.ethereumAddress,
        baseAddress: this.baseAddress,
      });
    } catch (error: any) {
      logger.error(`Failed to initialize wallet manager: ${error.message || error}`);
      throw error;
    }
  }

  async getKyveBalance(): Promise<Coin | null> {
    try {
      if (!this.kyveClient) {
        throw new Error('Kyve client not initialized');
      }

      const balance = await this.kyveClient.getBalance(this.kyveAddress, 'ukyve');
      logger.debug('KYVE balance:', balance);
      return balance;
    } catch (error: any) {
      logger.error(`Failed to get KYVE balance: ${error.message || error}`);
      return null;
    }
  }

  async getUsdcBalance(): Promise<Coin | null> {
    // Note: USDC balance on Ethereum requires querying via EVM RPC
    // This would need ethers.js or similar library
    // For now, return null as we can't query EVM balances with CosmJS
    logger.warn('USDC balance query not implemented for Ethereum - requires EVM library');
    return null;
  }

  async getAllBalances(): Promise<{ kyve: Coin | null; usdc: Coin | null }> {
    const kyve = await this.getKyveBalance();
    const usdc = await this.getUsdcBalance();

    return { kyve, usdc };
  }

  getKyveAddress(): string {
    return this.kyveAddress;
  }

  getEthereumAddress(): string {
    return this.ethereumAddress;
  }

  getWallet(): DirectSecp256k1HdWallet | DirectSecp256k1Wallet | null {
    return this.wallet;
  }

  async getCosmosSignerForChain(chainId: string): Promise<DirectSecp256k1HdWallet | DirectSecp256k1Wallet> {
    if (!walletConfig.mnemonic && !walletConfig.privateKey) {
      throw new Error('No wallet credentials available');
    }

    let prefix = 'cosmos';
    if (chainId.includes('kyve')) {
      prefix = 'kyve';
    } else if (chainId.includes('noble')) {
      prefix = 'noble';
    } else if (chainId.includes('osmosis')) {
      prefix = 'osmo';
    } else if (chainId.includes('axelar')) {
      prefix = 'axelar';
    }

    if (walletConfig.mnemonic) {
      return await DirectSecp256k1HdWallet.fromMnemonic(walletConfig.mnemonic, {
        prefix,
      });
    } else {
      const privateKey = Buffer.from(walletConfig.privateKey!, 'hex');
      return await DirectSecp256k1Wallet.fromKey(privateKey, prefix);
    }
  }

  getBaseAddress(): string {
    return this.baseAddress;
  }

  formatAmount(amount: string, decimals: number = 6): string {
    const value = parseFloat(amount) / Math.pow(10, decimals);
    return value.toFixed(decimals);
  }

  parseAmount(amount: string, decimals: number = 6): string {
    const value = parseFloat(amount) * Math.pow(10, decimals);
    return Math.floor(value).toString();
  }
}