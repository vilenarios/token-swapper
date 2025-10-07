# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automated bot for swapping KYVE tokens to USDC on Base L2 or Ethereum L1 using Skip Go API. Features USD-based swap amounts, cost basis tracking, transaction logging in JSON/CSV formats, multi-chain transaction tracking, and comprehensive price protection mechanisms.

## Key Commands

```bash
# Development & Execution
npm run dev          # Run with auto-reload (tsx watch)
npm start            # Run production build
npm start once       # Execute single swap and exit
npm start status     # Display balances and statistics
npm start export     # Export transaction history to CSV

# Build & Quality Checks
npm run build        # Compile TypeScript (tsc)
npm run typecheck    # Type check without emitting (tsc --noEmit)
npm run lint         # Lint TypeScript files (eslint src/**/*.ts)
npm test            # Run Jest tests

# Utilities
npm run export-csv   # Quick CSV export (tsx src/utils/exportTransactions.ts)

# Production Deployment
pm2 start npm --name kyve-swapper -- start
pm2 logs kyve-swapper
pm2 status
```

## Architecture

### Core Services (`src/services/`)

**SwapOrchestrator** - Main coordinator managing the entire swap workflow:
- Converts USD amounts to KYVE using live price data
- Calculates swap amounts based on balance, percentage, reserve, and USD limits
- Enforces price protection (MIN_EFFECTIVE_RATE)
- Coordinates between all services
- Manages transaction lifecycle with timeout protection
- Tracks all intermediate chain transactions

**WalletManager** - Wallet operations:
- Manages signing for KYVE (kyve-1) chain
- Supports Ethereum L1 and Base L2 destination addresses
- Handles mnemonic/private key initialization
- Provides balance queries

**SkipSwapService** - Skip API integration:
- Finds optimal swap routes across multiple chains
- Executes swaps with slippage protection
- Monitors transaction status across all chains
- Implements 10-minute timeout for cross-chain swaps
- Tracks transactions: KYVE → Osmosis → Axelar → Base L2/Ethereum L1
- Enables EVM swaps and split routes for Base L2 routing

**PriceService** - Price data management:
- Fetches from CoinGecko API (no API key needed)
- Implements 5-minute caching to reduce API calls
- Provides USD cost basis calculations
- Used for USD to KYVE amount conversion

**TransactionLogger** - Persistence layer:
- Maintains JSON transaction history with all chain transactions
- Auto-exports to CSV with accounting fields
- Tracks cumulative statistics
- CSV includes destination chain name and all intermediate tx hashes

**NotificationService** - External alerts:
- Discord webhook integration
- Telegram bot notifications
- Configurable alert levels

### Swap Amount Determination

The orchestrator calculates swap amounts using USD-based configuration:
1. Fetch current KYVE price from CoinGecko
2. Convert MIN_SWAP_AMOUNT_USD and MAX_SWAP_AMOUNT_USD to KYVE amounts
3. Get current KYVE balance
4. Apply SWAP_PERCENTAGE (0-100%)
5. Subtract KEEP_RESERVE_KYVE (for gas fees)
6. Cap at MAX_SWAP_AMOUNT_USD equivalent in KYVE
7. Validate against MIN_SWAP_AMOUNT_USD equivalent

Example: With KYVE at $0.00646, MAX_SWAP_AMOUNT_USD=1000 becomes ~154,799 KYVE

### Configuration

Environment variables validated via Zod (`src/config/index.ts`):
- Skip API key optional (free tier default)
- Wallet via MNEMONIC or PRIVATE_KEY
- Destination addresses for Ethereum L1 and Base L2
- USDC_DESTINATION: 'ethereum' or 'base' (default: base)
- USD-based swap amounts: MIN_SWAP_AMOUNT_USD, MAX_SWAP_AMOUNT_USD
- SWAP_TIMEOUT_MINUTES: Cross-chain swap timeout (default: 10)
- Price protection: slippage, minimum rates
- Schedule: cron pattern for automation (default: daily at midnight)

Dynamic destination configuration:
- Base L2 (8453): USDC contract 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- Ethereum L1 (1): USDC contract 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48

### Cross-Chain Swap Flow

```
KYVE (kyve-1)
  ↓ IBC Transfer
Osmosis (osmosis-1)
  ↓ Axelar Bridge
Axelar (axelar-dojo-1)
  ↓ Contract Call
Base L2 (8453) or Ethereum L1 (1)
```

Typical completion: 3-5 minutes
Timeout: 10 minutes (configurable)

### Transaction Tracking

All intermediate transactions are tracked and logged:
- Primary TX: KYVE send transaction
- Receive TX: Osmosis receive
- Acknowledge TX: KYVE acknowledge
- Confirm TX: Axelar confirmation
- Approve TX: EVM approve (Base/Ethereum)
- Execute TX: EVM execute (final USDC transfer)

CSV export includes all chain transactions in format: `chainId:txHash | chainId:txHash`

### Key Technical Details

**Skip API Configuration:**
- RPC endpoints configured for kyve-1, osmosis-1, chain 1 (Ethereum), chain 8453 (Base)
- `evmSwaps: true` - Required for Base L2 routing
- `splitRoutes: true` - Allows route splitting for better rates
- `allowUnsafe: true` - Allows routes with bridge fees

**Timeout Implementation:**
- Uses `Promise.race()` to wrap Skip SDK's `executeRoute()`
- Configurable via SWAP_TIMEOUT_MINUTES env variable
- Default 10 minutes (600,000ms)
- Prevents hanging on slow cross-chain operations

**USD to KYVE Conversion:**
- Fetches live KYVE/USD price before each swap
- Converts MIN/MAX USD amounts to KYVE micro units
- Formula: `(USD_AMOUNT / kyvePrice) * 10^6`
- Logs show both USD cost basis and KYVE amounts

## Testing

Uses Jest with ts-jest for TypeScript support. Test files should follow `*.test.ts` or `*.spec.ts` naming convention.

## Common Tasks

### Adding New Destination Chain
1. Add chain RPC config to `src/config/index.ts`
2. Add chain address to WalletManager
3. Update destination config function in config
4. Add chain ID to Skip client endpoints
5. Update transaction logger for chain name mapping

### Adjusting Swap Logic
- Swap amount calculation: `src/services/swapOrchestrator.ts` (lines 63-96)
- USD conversion happens first, then percentage/reserve rules apply
- All amount checks now use USD-based values

### Modifying Timeout
- Change `SWAP_TIMEOUT_MINUTES` in .env
- Timeout implemented in `src/services/skipClient.ts` (lines 104-108, 164)

### CSV Export Format
- Configured in `src/services/transactionLogger.ts`
- Dynamic chain name detection based on toChainId
- All chain transactions formatted as pipe-separated list

## Important Notes

- Keep KEEP_RESERVE_KYVE ≥ 1 to ensure gas for transactions
- Base L2 recommended over Ethereum L1 (lower fees, faster)
- Cross-chain swaps require patience (3-5 min typical)
- Failed transactions logged but not exported to CSV
- Price fetching cached for 5 minutes to reduce API calls
- All intermediate transactions tracked for complete audit trail
