# KYVE Swapper Bot

An automated bot for swapping KYVE tokens to USDC using the Skip Go API. The bot tracks cost basis, maintains detailed transaction logs, and exports data in CSV format for accounting purposes.

## Features

- 🔄 Automated periodic swaps from KYVE to USDC
- 📊 Real-time price tracking and cost basis calculation
- 📝 Comprehensive transaction logging with CSV export
- 📨 Discord and Telegram notifications
- 🔒 Secure wallet management
- 🧪 Dry-run mode for testing
- 📈 Detailed statistics and reporting

## Prerequisites

- Node.js v18 or higher
- TypeScript
- A KYVE wallet with tokens
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
   - Skip API key
   - RPC endpoints (defaults provided)
   - Swap configuration
   - Optional notification webhooks

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SKIP_API_KEY` | Skip API key (optional, for higher rate limits) | - |
| `MNEMONIC` | Wallet mnemonic phrase* | - |
| `PRIVATE_KEY` | Wallet private key (alternative to mnemonic)* | - |
| **Swap Amount Controls** |
| `MIN_SWAP_AMOUNT_KYVE` | Minimum KYVE to trigger swap | 100 |
| `MAX_SWAP_AMOUNT_KYVE` | Maximum KYVE per swap | 1000000 |
| `SWAP_PERCENTAGE` | Percentage of balance to swap (0-100) | 100 |
| `KEEP_RESERVE_KYVE` | KYVE amount to always keep in wallet | 0 |
| **Price Protection** |
| `MAX_SLIPPAGE_PERCENT` | Maximum acceptable slippage (%) | 2 |
| `MIN_EFFECTIVE_RATE` | Minimum USDC per KYVE rate | 0.0001 |
| **Schedule & Mode** |
| `SWAP_SCHEDULE` | Cron schedule for automated swaps | 0 */6 * * * |
| `DRY_RUN` | Test mode without real transactions | false |

*Either `MNEMONIC` or `PRIVATE_KEY` must be provided

### How Swap Amounts Are Determined

The bot uses a sophisticated system to determine how much KYVE to swap:

1. **Balance Check**: Gets current KYVE wallet balance
2. **Percentage Rule**: Applies `SWAP_PERCENTAGE` (e.g., 50% = swap half the balance)
3. **Reserve Rule**: Subtracts `KEEP_RESERVE_KYVE` from available amount
4. **Maximum Cap**: Limits to `MAX_SWAP_AMOUNT_KYVE` per transaction
5. **Minimum Check**: Only swaps if amount exceeds `MIN_SWAP_AMOUNT_KYVE`

**Example Configuration Scenarios:**

- **Conservative**: Swap 25% of balance, keep 1000 KYVE reserve
  ```
  SWAP_PERCENTAGE=25
  KEEP_RESERVE_KYVE=1000
  ```

- **Aggressive**: Swap everything above 100 KYVE
  ```
  SWAP_PERCENTAGE=100
  KEEP_RESERVE_KYVE=100
  ```

- **Fixed Amount**: Swap exactly 5000 KYVE when available
  ```
  MAX_SWAP_AMOUNT_KYVE=5000
  MIN_SWAP_AMOUNT_KYVE=5000
  ```

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
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight
- `0 9 * * 1` - Weekly on Monday at 9 AM

## Usage

### Start the Bot (Scheduled Mode)
```bash
npm start
```

### Run Single Swap
```bash
npm start once
```

### Check Status
```bash
npm start status
```

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

1. **JSON Log** (`data/transactions.json`): Complete transaction history
2. **CSV Export** (`data/swap_history.csv`): Accounting-friendly format

### CSV Fields

- Timestamp
- Transaction ID
- From/To Token and Amount
- KYVE and USDC prices at execution
- Cost Basis in USD
- Gas Fees
- Effective Exchange Rate
- Transaction Hash
- Status

## Bot Commands

- `npm start` - Start bot with scheduler
- `npm start once` - Execute single swap
- `npm start status` - Display current status
- `npm start export` - Export transaction history
- `npm run dev` - Development mode with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run export-csv` - Quick CSV export

## Safety Features

- **Minimum Amount Check**: Won't swap below configured minimum
- **Slippage Protection**: Configurable maximum slippage
- **Dry Run Mode**: Test without real transactions
- **Balance Validation**: Checks balances before attempting swaps
- **Error Recovery**: Automatic retry with exponential backoff
- **Transaction Logging**: All swaps are logged for audit trail

## Monitoring

The bot provides multiple monitoring options:

1. **Console Logs**: Real-time status updates
2. **File Logs**: Rotating daily logs in `logs/` directory
3. **Discord Webhooks**: Transaction notifications
4. **Telegram Bot**: Real-time alerts
5. **CSV Reports**: For accounting and analysis

## Architecture

```
src/
├── services/
│   ├── walletManager.ts      # Cosmos wallet operations
│   ├── skipClient.ts         # Skip API integration
│   ├── priceService.ts       # Price fetching and caching
│   ├── transactionLogger.ts  # Transaction recording and CSV export
│   ├── notificationService.ts # Discord/Telegram alerts
│   └── swapOrchestrator.ts   # Main swap coordination
├── utils/
│   ├── logger.ts             # Winston logging setup
│   └── exportTransactions.ts # CSV export utility
├── types/
│   └── index.ts              # TypeScript interfaces
├── config/
│   └── index.ts              # Configuration management
└── index.ts                  # Main entry point
```

## Error Handling

The bot includes comprehensive error handling:
- Network failures are retried automatically
- Failed swaps are logged with error details
- Notifications sent for critical failures
- Graceful shutdown on SIGTERM/SIGINT

## Security Considerations

- Never commit `.env` file or expose private keys
- Use environment variables for sensitive data
- Consider using hardware wallet for production
- Regularly rotate API keys
- Monitor for unusual activity

## Development

### Build
```bash
npm run build
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test
```

## Troubleshooting

### No Route Found
- Verify KYVE and Noble chains are supported by Skip
- Check if liquidity exists for the swap pair
- Ensure sufficient balance for minimum swap

### Transaction Failures
- Check gas fees and wallet balance
- Verify RPC endpoints are accessible
- Ensure API key is valid

### CSV Export Issues
- Verify `data/` directory exists
- Check file permissions
- Ensure sufficient disk space

## Support

For Skip API issues: [Skip Discord](https://skip.build/discord)
For KYVE network: [KYVE Documentation](https://docs.kyve.network)

## License

MIT