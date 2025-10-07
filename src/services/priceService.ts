import axios from 'axios';
import { PriceData } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

interface PriceCache {
  [symbol: string]: {
    price: number;
    timestamp: number;
  };
}

export class PriceService {
  private cache: PriceCache = {};
  private cacheDuration: number;

  constructor() {
    this.cacheDuration = config.price.cacheDuration * 60 * 1000;
  }

  async getPrice(symbol: string): Promise<PriceData | null> {
    try {
      const cached = this.getCachedPrice(symbol);
      if (cached) {
        return cached;
      }

      const price = await this.fetchPriceFromCoinGecko(symbol);
      if (price) {
        this.cachePrice(symbol, price.price);
        return price;
      }

      return null;
    } catch (error: any) {
      logger.error(`Failed to get price for ${symbol}: ${error.message || error}`);
      return null;
    }
  }

  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();

    await Promise.all(
      symbols.map(async (symbol) => {
        const price = await this.getPrice(symbol);
        if (price) {
          prices.set(symbol, price);
        }
      })
    );

    return prices;
  }

  private getCachedPrice(symbol: string): PriceData | null {
    const cached = this.cache[symbol.toLowerCase()];
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheDuration) {
      delete this.cache[symbol.toLowerCase()];
      return null;
    }

    return {
      symbol,
      price: cached.price,
      timestamp: new Date(cached.timestamp).toISOString(),
      source: 'cache',
    };
  }

  private cachePrice(symbol: string, price: number): void {
    this.cache[symbol.toLowerCase()] = {
      price,
      timestamp: Date.now(),
    };
  }

  private async fetchPriceFromCoinGecko(symbol: string): Promise<PriceData | null> {
    try {
      const coinId = this.getCoinGeckoId(symbol);
      if (!coinId) {
        logger.warn(`No CoinGecko ID mapping for ${symbol}`);
        return null;
      }

      const url = `https://api.coingecko.com/api/v3/simple/price`;
      const params: any = {
        ids: coinId,
        vs_currencies: 'usd',
      };

      logger.debug(`Fetching price from CoinGecko: ${url}?${new URLSearchParams(params).toString()}`);
      const response = await axios.get(url, { params });
      logger.debug(`CoinGecko response:`, response.data);
      const price = response.data[coinId]?.usd;

      if (!price) {
        logger.warn(`No price data returned for ${symbol}`);
        return null;
      }

      logger.debug(`Fetched price for ${symbol}: $${price}`);

      return {
        symbol,
        price,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
      };
    } catch (error: any) {
      if (error.response?.status === 429) {
        logger.warn('CoinGecko rate limit hit, using fallback price source');
        return this.fetchPriceFromBackup(symbol);
      }
      logger.error(`CoinGecko API error for ${symbol}: Status ${error.response?.status}, Message: ${error.response?.data?.status?.error_message || error.message}`);
      throw error;
    }
  }

  private async fetchPriceFromBackup(symbol: string): Promise<PriceData | null> {
    try {
      if (symbol.toUpperCase() === 'USDC') {
        return {
          symbol: 'USDC',
          price: 1.0,
          timestamp: new Date().toISOString(),
          source: 'fixed',
        };
      }

      const url = `https://api.coinpaprika.com/v1/tickers/${this.getCoinPaprikaId(symbol)}`;
      const response = await axios.get(url);
      const price = response.data.quotes?.USD?.price;

      if (!price) {
        logger.warn(`No backup price data for ${symbol}`);
        return null;
      }

      return {
        symbol,
        price,
        timestamp: new Date().toISOString(),
        source: 'coinpaprika',
      };
    } catch (error: any) {
      logger.error(`Failed to fetch backup price for ${symbol}: ${error.message || error}`);
      return null;
    }
  }

  private getCoinGeckoId(symbol: string): string | null {
    const mappings: Record<string, string> = {
      'kyve': 'kyve-network',
      'usdc': 'usd-coin',
      'usdt': 'tether',
      'atom': 'cosmos',
      'osmo': 'osmosis',
    };

    return mappings[symbol.toLowerCase()] || null;
  }

  private getCoinPaprikaId(symbol: string): string {
    const mappings: Record<string, string> = {
      'kyve': 'kyve-kyve-network',
      'usdc': 'usdc-usd-coin',
      'usdt': 'usdt-tether',
      'atom': 'atom-cosmos',
      'osmo': 'osmo-osmosis',
    };

    return mappings[symbol.toLowerCase()] || `${symbol.toLowerCase()}-${symbol.toLowerCase()}`;
  }

  async calculateCostBasis(amount: string, token: string, decimals: number = 6): Promise<number> {
    const price = await this.getPrice(token);
    if (!price) {
      logger.warn(`Could not get price for ${token}, using 0`);
      return 0;
    }

    const amountFloat = parseFloat(amount) / Math.pow(10, decimals);
    return amountFloat * price.price;
  }

  async getGasPriceInUSD(gasUsed: string, chainId: string): Promise<number> {
    try {
      let tokenSymbol = 'atom';

      if (chainId.includes('kyve')) {
        tokenSymbol = 'kyve';
      } else if (chainId.includes('noble')) {
        tokenSymbol = 'atom';
      } else if (chainId.includes('osmosis')) {
        tokenSymbol = 'osmo';
      }

      const price = await this.getPrice(tokenSymbol);
      if (!price) {
        return 0;
      }

      const gasAmount = parseFloat(gasUsed) / Math.pow(10, 6);
      return gasAmount * price.price;
    } catch (error: any) {
      logger.error(`Failed to calculate gas price in USD: ${error.message || error}`);
      return 0;
    }
  }
}