# KYVE Swapper Bot

An automated bot for swapping KYVE tokens to USDC on Base L2 or Ethereum L1 using the Skip Go API. The bot tracks cost basis, maintains detailed transaction logs, and exports data in CSV format for accounting purposes.

## Features

- 🔄 Automated periodic swaps from KYVE to USDC (Base L2 or Ethereum L1)
- 💵 USD-based swap amounts with automatic price conversion
- 📊 Real-time price tracking and cost basis calculation
- 📝 Comprehensive transaction logging with CSV export
- 🔗 Multi-chain support (KYVE → Osmosis → Axelar → Base L2/Ethereum L1)
- 📨 Discord and Telegram notifications
- 🔒 Secure wallet management
- 🧪 Dry-run mode for testing
- ⏱️ Configurable timeout for cross-chain swaps
- 📈 Detailed statistics and reporting

## Prerequisites

- Node.js v18 or higher
- TypeScript
- A KYVE wallet with tokens
- Ethereum or Base L2 address for receiving USDC
- Skip API key (optional - only for higher rate limits)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd kyve-swapper
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your `.env` file with:
   - Your wallet mnemonic or private key
   - Ethereum and/or Base L2 addresses for receiving USDC
   - Skip API key (optional)
   - RPC endpoints (defaults provided)
   - Swap configuration
   - Optional notification webhooks

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| **API & Wallet** |
| `SKIP_API_KEY` | Skip API key (optional, for higher rate limits) | - |
| `MNEMONIC` | Wallet mnemonic phrase* | - |
| `PRIVATE_KEY` | Wallet private key (alternative to mnemonic)* | - |
| **Destination Addresses** |
| `ETHEREUM_ADDRESS` | Ethereum L1 address for receiving USDC | - |
| `ETHEREUM_BASE_ADDRESS` | Base L2 address for receiving USDC | - |
| `USDC_DESTINATION` | Target chain: 'ethereum' or 'base' | base |
| **Swap Amount Controls (USD-based)** |
| `MIN_SWAP_AMOUNT_USD` | Minimum USD value to trigger swap | 10 |
| `MAX_SWAP_AMOUNT_USD` | Maximum USD value per swap | 1000 |
| `SWAP_PERCENTAGE` | Percentage of balance to swap (0-100) | 100 |
| `KEEP_RESERVE_KYVE` | KYVE amount to always keep for gas | 1 |
| **Price Protection** |
| `MAX_SLIPPAGE_PERCENT` | Maximum acceptable slippage (%) | 11 |
| `MIN_EFFECTIVE_RATE` | Minimum USDC per KYVE rate | 0.0001 |
| **Schedule & Mode** |
| `SWAP_SCHEDULE` | Cron schedule for automated swaps | 0 0 * * * |
| `SWAP_TIMEOUT_MINUTES` | Timeout for cross-chain swaps | 10 |
| `DRY_RUN` | Test mode without real transactions | false |

*Either `MNEMONIC` or `PRIVATE_KEY` must be provided

### How Swap Amounts Are Determined

The bot uses USD-based swap amounts that are automatically converted to KYVE based on current market price:

1. **Balance Check**: Gets current KYVE wallet balance
2. **Price Lookup**: Fetches current KYVE/USD price from CoinGecko
3. **USD Conversion**: Converts `MAX_SWAP_AMOUNT_USD` to KYVE amount
4. **Percentage Rule**: Applies `SWAP_PERCENTAGE` (e.g., 99% to leave room for gas)
5. **Reserve Rule**: Subtracts `KEEP_RESERVE_KYVE` from available amount (for gas fees)
6. **Maximum Cap**: Limits to USD equivalent of `MAX_SWAP_AMOUNT_USD`
7. **Minimum Check**: Only swaps if USD value exceeds `MIN_SWAP_AMOUNT_USD`

**Example Configuration Scenarios:**

- **Daily $1000 limit**: Swap up to $1000 worth of KYVE per day
  ```
  MIN_SWAP_AMOUNT_USD=10
  MAX_SWAP_AMOUNT_USD=1000
  SWAP_SCHEDULE=0 0 * * *
  KEEP_RESERVE_KYVE=1
  ```

- **Conservative with $10K wallet**: Keep reserve, swap when above minimum
  ```
  MIN_SWAP_AMOUNT_USD=100
  MAX_SWAP_AMOUNT_USD=5000
  SWAP_PERCENTAGE=99
  KEEP_RESERVE_KYVE=10
  ```

- **Small frequent swaps**: Swap $50 twice daily
  ```
  MIN_SWAP_AMOUNT_USD=50
  MAX_SWAP_AMOUNT_USD=50
  SWAP_SCHEDULE=0 0,12 * * *
  ```

### Chain Selection

Choose where to receive USDC:

- **Base L2** (recommended): Lower gas fees, faster finality
  ```
  USDC_DESTINATION=base
  ETHEREUM_BASE_ADDRESS=0x...
  ```

- **Ethereum L1**: More liquidity, higher gas fees
  ```
  USDC_DESTINATION=ethereum
  ETHEREUM_ADDRESS=0x...
  ```

### Swap Flow

The bot uses Skip Protocol for cross-chain swaps:

```
KYVE (kyve-1) → Osmosis (osmosis-1) → Axelar Bridge → Base L2 (8453) or Ethereum L1 (1)
```

Typical completion time: 3-5 minutes

### Price Protection Rules

The bot will **cancel the swap** if:

1. **Low Rate**: Effective rate < `MIN_EFFECTIVE_RATE` (e.g., never accept less than 0.0001 USDC per KYVE)
2. **High Slippage**: Actual execution would be > `MAX_SLIPPAGE_PERCENT` worse than quoted price

These protections ensure you don't execute swaps during:
- Low liquidity periods
- Network congestion causing delays
- Extreme volatility

### Swap Schedule

The bot uses cron syntax for scheduling. Examples:
- `0 0 * * *` - Daily at midnight (default)
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1` - Weekly on Monday at 9 AM
- `0 0,12 * * *` - Twice daily at midnight and noon

## Usage

### Start the Bot (Scheduled Mode)
```bash
npm start
```

### Production Deployment with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start npm --name kyve-swapper -- start

# Monitor logs
pm2 logs kyve-swapper

# Check status
pm2 status

# Auto-start on system reboot
pm2 startup
pm2 save
```

### Run Single Swap
```bash
npm start once
```

### Check Status
```bash
npm start status
```

Output shows:
- Wallet addresses (KYVE, Ethereum L1, Base L2)
- Current balances
- Transaction statistics
- Active configuration

### Export Transaction History
```bash
npm run export-csv
# or
npm start export
```

### Development Mode
```bash
npm run dev
```

## Transaction Logs

The bot maintains two types of logs:

1. **JSON Log** (`data/transactions.json`): Complete transaction history with all chain transactions
2. **CSV Export** (`data/swap_history.csv`): Accounting-friendly format

### CSV Fields

- Date
- Sent Amount / Currency
- Received Amount / Currency
- Fee Amount / Currency
- Net Worth Amount / Currency
- Label (Crypto Swap)
- Description (includes destination chain)
- TxHash (primary transaction hash)
- Chain Transactions (all intermediate tx hashes)

The CSV format is compatible with crypto tax software and accounting tools.

## Bot Commands

- `npm start` - Start bot with scheduler
- `npm start once` - Execute single swap
- `npm start status` - Display current status
- `npm start export` - Export transaction history
- `npm run dev` - Development mode with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run typecheck` - Type check without building
- `npm run export-csv` - Quick CSV export

## Safety Features

- **USD-Based Limits**: Set dollar limits regardless of KYVE price fluctuations
- **Minimum Amount Check**: Won't swap below configured minimum
- **Slippage Protection**: Configurable maximum slippage
- **Gas Reserve**: Automatically keeps reserve for transaction fees
- **Timeout Protection**: 10-minute timeout prevents hanging on slow swaps
- **Dry Run Mode**: Test without real transactions
- **Balance Validation**: Checks balances before attempting swaps
- **Transaction Logging**: All swaps logged with full chain trace
- **Multi-Chain Tracking**: Tracks transactions across all intermediate chains

## Monitoring

The bot provides multiple monitoring options:

1. **Console Logs**: Real-time status updates with swap progress
2. **File Logs**: Rotating daily logs in `logs/` directory
3. **Discord Webhooks**: Transaction notifications
4. **Telegram Bot**: Real-time alerts
5. **CSV Reports**: For accounting and analysis
6. **Chain Explorers**: Links to all transaction hashes

## Architecture

```
src/
├── services/
│   ├── walletManager.ts      # Cosmos & EVM address management
│   ├── skipClient.ts         # Skip API integration with timeout
│   ├── priceService.ts       # CoinGecko price fetching
│   ├── transactionLogger.ts  # Transaction recording and CSV export
│   ├── notificationService.ts # Discord/Telegram alerts
│   └── swapOrchestrator.ts   # Main swap coordination with USD conversion
├── utils/
│   ├── logger.ts             # Winston logging setup
│   └── exportTransactions.ts # CSV export utility
├── types/
│   └── index.ts              # TypeScript interfaces
├── config/
│   └── index.ts              # Configuration with dynamic destination
└── index.ts                  # Main entry point
```

## Error Handling

The bot includes comprehensive error handling:
- Network failures trigger timeout after 10 minutes
- Failed swaps are logged with error details
- Notifications sent for critical failures
- Graceful shutdown on SIGTERM/SIGINT
- Transaction state preserved even on timeout

## Security Considerations

- Never commit `.env` file or expose private keys
- Use environment variables for sensitive data
- Keep separate wallets for automated vs manual operations
- Regularly rotate API keys
- Monitor for unusual activity
- Use hardware wallet integration for large amounts

## Development

### Build
```bash
npm run build
```

### Type Checking
```bash
npm run typecheck
```

### Testing
```bash
npm test
```

## Troubleshooting

### No Route Found
- Verify KYVE chain is supported by Skip
- Check if liquidity exists for the swap pair
- Ensure sufficient balance for minimum swap ($10 USD equivalent)
- Verify Base L2 or Ethereum destination addresses are correct

### Transaction Timeouts
- Default timeout is 10 minutes (configurable)
- Cross-chain swaps typically take 3-5 minutes
- Check individual chain transactions in logs for delays
- Verify all RPC endpoints are accessible

### Transaction Failures
- Check gas fees and wallet balance (keep 1+ KYVE reserve)
- Verify RPC endpoints are accessible
- Ensure destination addresses are correct format (0x... for EVM)
- Check Skip API status

### CSV Export Issues
- Verify `data/` directory exists
- Check file permissions
- Ensure sufficient disk space
- Failed swaps are excluded from CSV exports

### Price Fetch Failures
- CoinGecko API rate limits (5 minute cache helps)
- Network connectivity issues
- Invalid token IDs

## Support

- Skip Protocol: [Skip Documentation](https://docs.skip.build)
- KYVE Network: [KYVE Docs](https://docs.kyve.network)
- Base L2: [Base Documentation](https://docs.base.org)

## License

MIT
