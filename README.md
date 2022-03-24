# Orca Whirlpool SDK

The Orca Whirlpool SDK contains a set of simple to use APIs to allow developers to interact with the Orca concentrated liquidity pools.

> Note: This is a pre-release. The public APIs are subject to change in the coming weeks.

Learn more Orca [here](https://docs.orca.so).

### Interact with Whirlpools

- Swap on the new Whirlpools.
- Manage your Whirlpool positions. (ex. Open/close position, add/remove liquidity, collect fees & rewards)
- Get offchain pool data (ex. price history, TVL, APR)

**Supported Orca Pools**

- As part of the Whirlpool Beta launch, we support `ORCA/USDC`, `SOL/USDC` and `mSOL/USDC`.

**Coming Soon**

- The API will be modified to improve developer experience.
- Open-sourcing the inner `@orca-so/whirlpool-client-sdk` so power-users can construct Whirlpool instruction calls directly. (Feel free to take a look when you pull down this module!)

# Installation

Use your environment's package manager to install @orca-so/whirlpool-sdk and other related packages into your project.

```bash
yarn add @orca-so/whirlpool-sdk
```

```bash
npm install @orca-so/whirlpool-sdk
```

# Sample Code

```typescript
// Derive the Whirlpool address from token mints
const orca = new OrcaWhirlpoolClient({ network: OrcaNetwork.MAINNET });
const poolAddress = await orca.pool.deriveAddress(ORCA_MINT, USDC_MINT);

// Fetch an instance of the pool
const poolData = await orca.getPool(poolAddress);
console.log(poolData.liquidity);
console.log(poolData.price);
console.log(poolData.tokenVaultAmountA);
console.log(poolData.tokenVaultAmountB);

// Open a position
const openPositionQuote = await orca.pool.getOpenPositionQuote({
  poolAddress,
  tokenMint: ORCA_MINT,
  tokenAmount: new u64(1_000_000_000),
});
const openPositionTx = await orca.pool.getOpenPositionTx({
  provider,
  quote: openPositionQuote,
});
const openPositionTxId = await openPositionTx.buildAndExecute();

// Construct a swap instruction on this pool and execute.
const swapQuote = await orca.pool.getSwapQuote({
  poolAddress,
  tokenMint: ORCA_MINT,
  tokenAmount: new u64(1_000_000),
});
const swapTx = await orca.pool.getSwapTx({
  provider,
  quote: swapQuote,
});
const swapTxId = swapTx.buildAndExecute();
```

# Technical Notes

**Code is not stable**

This repo is in a pre-release state. The public API will undergo a major refactor prior to our beta release.

# Support

**Integration Questions**

You are welcome to source-dive into the SDK and the inner `@orca-so/whirlpool-client-sdk` to interact with the Whirlpool contract. However,we will not be able to provide integration support at this moment.

**Issues / Bugs**

If you found a bug, open up an issue on github with the prefix [ISSUE]. To help us be more effective in resolving the problem, be specific in the steps it took to reproduce the problem (ex. when did the issue occur, code samples, debug logs etc).

# License

[MIT](https://choosealicense.com/licenses/mit/)
