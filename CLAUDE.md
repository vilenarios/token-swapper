# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automated bot for swapping KYVE tokens to USDC using Skip Go API. Features cost basis tracking, transaction logging in JSON/CSV formats, and comprehensive price protection mechanisms.

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
```

## Architecture

### Core Services (`src/services/`)

**SwapOrchestrator** - Main coordinator managing the entire swap workflow:
- Calculates swap amounts based on balance, percentage, reserve, and limits
- Enforces price protection (MIN_EFFECTIVE_RATE)
- Coordinates between all services
- Manages transaction lifecycle

**WalletManager** - Cosmos wallet operations:
- Manages signing for KYVE (kyve-1) and Noble (noble-1) chains
- Handles mnemonic/private key initialization
- Provides balance queries

**SkipSwapService** - Skip API integration:
- Finds optimal swap routes
- Executes swaps with slippage protection
- Monitors transaction status

**PriceService** - Price data management:
- Fetches from CoinGecko API
- Implements caching to reduce API calls
- Provides USD cost basis calculations

**TransactionLogger** - Persistence layer:
- Maintains JSON transaction history
- Auto-exports to CSV with accounting fields
- Tracks cumulative statistics

**NotificationService** - External alerts:
- Discord webhook integration
- Telegram bot notifications
- Configurable alert levels

### Swap Amount Determination

The orchestrator calculates swap amounts through sequential rules:
1. Get current KYVE balance
2. Apply SWAP_PERCENTAGE (0-100%)
3. Subtract KEEP_RESERVE_KYVE
4. Cap at MAX_SWAP_AMOUNT_KYVE
5. Validate against MIN_SWAP_AMOUNT_KYVE

### Configuration

Environment variables validated via Zod (`src/config/index.ts`):
- Skip API key optional (free tier default)
- Wallet via MNEMONIC or PRIVATE_KEY
- Swap parameters: percentages, amounts, reserves
- Price protection: slippage, minimum rates
- Schedule: cron pattern for automation

## Testing

Uses Jest with ts-jest for TypeScript support. Test files should follow `*.test.ts` or `*.spec.ts` naming convention.