# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an automated bot for swapping KYVE tokens to USDC using the Skip Go API. The bot tracks cost basis in USD, maintains transaction logs in both JSON and CSV formats for accounting purposes, and includes comprehensive price protection mechanisms.

## Key Commands

```bash
# Development
npm run dev          # Run in development mode with auto-reload
npm start            # Run production build (requires npm run build first)
npm start once       # Execute single swap and exit
npm start status     # Check bot status and balances
npm start export     # Export transaction history to CSV

# Build & Testing
npm run build        # Compile TypeScript to JavaScript
npm run typecheck    # Type check without building
npm run lint         # Run ESLint on TypeScript files
npm test            # Run Jest tests

# Utilities
npm run export-csv   # Quick CSV export of transaction history
```

## Architecture

### Service Layer (`src/services/`)
- **SwapOrchestrator**: Main coordinator that manages the swap workflow, determines swap amounts based on configuration rules, and enforces price protection
- **WalletManager**: Handles Cosmos wallet operations, manages signing for both KYVE and Noble chains
- **SkipSwapService**: Interfaces with Skip API for route finding and swap execution
- **PriceService**: Fetches prices from CoinGecko with caching and fallback sources
- **TransactionLogger**: Persists swaps to JSON and auto-exports to CSV with cost basis tracking
- **NotificationService**: Sends alerts via Discord/Telegram webhooks

### Core Flow
1. SwapOrchestrator checks balance and calculates swap amount based on:
   - SWAP_PERCENTAGE (e.g., 50% of balance)
   - KEEP_RESERVE_KYVE (amount to retain)
   - MAX_SWAP_AMOUNT_KYVE (cap per transaction)
   - MIN_SWAP_AMOUNT_KYVE (minimum threshold)

2. Skip API provides route with slippage protection (MAX_SLIPPAGE_PERCENT)
3. Bot validates effective rate against MIN_EFFECTIVE_RATE
4. Transaction executes with automatic CSV logging including USD cost basis

### Configuration (`src/config/index.ts`)
Uses Zod for validation with environment variables. Skip API key is optional (uses free tier by default).

### Entry Points (`src/index.ts`)
- Default: Runs scheduled swaps using cron pattern
- `once`: Single swap execution
- `status`: Display balances and statistics
- `export`: Export transaction history

## Important Configuration Notes

- The bot swaps KYVE (on kyve-1) to USDC (on noble-1) via Skip API
- Slippage protection is handled by Skip API's `slippageTolerancePercent`
- MIN_EFFECTIVE_RATE provides a hard floor for swap rates
- All transactions are automatically logged with cost basis for accounting
- CSV export includes all relevant fields for tax/accounting purposes