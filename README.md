# Orca Whirlpool SDK

The Orca SDK contains a set of simple to use APIs to allow developers to integrate with the Orca exchange platform.

Learn more Orca [here](https://docs.orca.so).

### Trading Orca Liquidity Pools

- Get detailed quotes and make swaps between trading pairs in an Orca Pool
- Check your Orca Pool LP token balance and total supply

**Supported Orca Pools**

- The SDK supports all pools currently listed on [Orca](https://www.orca.so/pools)

### Provide Liquidity to Orca Pools

- Deposit liquidity to supported Orca Pools
  - Deposit a trading pair, and receive LP token
- Withdraw liquidity from supported Orca Pools
  - Withdraw a trading pair in exchange for LP token

**Aquafarm Support**

- After depositing liquidtiy to a pool, the LP token can be deposited into
  the corresponding farm to receive an equivalent amount of farm token
- Remember to withdraw the LP token in exchange for farm token before
  withdrawing liquidity from Orca Pool

**DoubleDip Support**

- For farms with double-dip, the aquafarm tokens can be deposited into
  double-dip farm to receive double-dip rewards

**Features Coming Soon**

- More trader information (APY, Volume)

# Installation

Use your environment's package manager to install @orca-so/sdk and other related packages into your project.

```bash
yarn add @orca-so/sdk @solana/web3.js decimal.js
```

```bash
npm install @orca-so/sdk @solana/web3.js decimal.js
```

# Usage

```typescript
// Get pool address from token mints
const orca = new OrcaWhirlpoolClient({ network: OrcaNetwork.MAINNET });
const poolAddress = await orca.pool.deriveAddress(ORCA_MINT, USDC_MINT);

// Get pool data
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
console.log("opened new position", openPositionTxId);

// Swap
const swapQuote = await orca.pool.getSwapQuote({
  poolAddress,
  tokenMint: ORCA_MINT,
  tokenAmount: new u64(1_000_000),
});
const swapTx = await orca.pool.getSwapTx({
  provider,
  quote: swapQuote,
});
console.log("swapped", swapTx);

// Some additional functions:
//   orca.admin.getInitRewardTx
//   orca.admin.getSetRewardEmissionsTx
//   orca.pool.getLiquidityDistribution
//   orca.position.getAddLiquidityTx
//   orca.position.getCollectFeesAndRewardsTx
//   orca.position.getRemoveLiquidityTx
```

# Technical Notes

**Decimals & OrcaU64**

The SDK relies on the use of [Decimal](https://github.com/MikeMcl/decimal.js/) for number inputs and Decimal/[OrcaU64](https://github.com/orca-so/typescript-sdk/blob/main/src/public/utils/orca-u64.ts) for token-value inputs. If a Decimal instance is provided for a token-value input, it will be automatically transformed to the token's scale.

**Stability of the Public Util Functions**

We hope you find the tools we used to build our API useful in the public/utils folder. Due to our on-going development of the Orca platform, we cannot guarrantee the stability of the util APIs. The trading APIs can only be upgraded on major version updates.

# Support

**Integration Questions**

Have problems integrating with the SDK? Pop by over to our [Discord](https://discord.gg/nSwGWn5KSG) #integrations channel and chat with one of our engineers.

**Issues / Bugs**

If you found a bug, open up an issue on github with the prefix [ISSUE]. To help us be more effective in resolving the problem, be specific in the steps it took to reproduce the problem (ex. when did the issue occur, code samples, debug logs etc).

**Feedback**

Got ideas on how to improve the system? Open up an issue on github with the prefix [FEEDBACK] and let's brainstorm more about it together!

# License

[MIT](https://choosealicense.com/licenses/mit/)
