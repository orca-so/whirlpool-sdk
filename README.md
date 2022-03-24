> Note: This is a pre-release. The public APIs are subject to change in the coming weeks.
> 
# Orca Whirlpool SDK

The Orca Whirlpool SDK contains a set of simple to use APIs to allow developers to interact with the Orca concentrated liquidity pools.

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
  import { Provider } from "@project-serum/anchor";
  import { Connection, PublicKey } from "@solana/web3.js";
  
  // NOTE: The following code will work currently but the API will change in upcoming releases.

  // You can use Anchor.Provider.env() and use env vars or pass in a custom Wallet implementation to do signing
  const provider = new Provider(connection, wallet, Provider.defaultOptions());

  // Derive the Whirlpool address from token mints
  const orca = new OrcaWhirlpoolClient({ network: OrcaNetwork.MAINNET });
  const poolAddress = await orca.pool.derivePDA(ORCA_MINT, USDC_MINT, false)
    .publicKey;

  // Fetch an instance of the pool
  const poolData = await orca.getPool(poolAddress);
  if (!poolData) {
    return;
  }
  console.log(poolData.liquidity);
  console.log(poolData.price);
  console.log(poolData.tokenVaultAmountA);
  console.log(poolData.tokenVaultAmountB);

  // Open a position
  const openPositionQuote = await orca.pool.getOpenPositionQuote({
    poolAddress,
    tokenMint: ORCA_MINT,
    tokenAmount: new u64(1_000_000_000),
    refresh: true,
    tickLowerIndex: priceToTickIndex(new Decimal(0), 6, 6),
    tickUpperIndex: priceToTickIndex(new Decimal(100), 6, 6),
  });
  const openPositionTx = await orca.pool.getOpenPositionTx({
    provider,
    quote: openPositionQuote,
  });
  const openPositionTxId = await openPositionTx.tx.buildAndExecute();

  // Construct a swap instruction on this pool and execute.
  const swapQuote = await orca.pool.getSwapQuote({
    poolAddress,
    tokenMint: ORCA_MINT,
    tokenAmount: new u64(1_000_000),
    isInput: true,
    refresh: true,
  });
  const swapTx = await orca.pool.getSwapTx({
    provider,
    quote: swapQuote,
  });
  const swapTxId = swapTx.buildAndExecute();
```

If you are using Provider.env(), you can invoke with the following:
```bash
ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com ANCHOR_WALLET=<Path to your keypair> ts-node <Path to file>.ts
```

# Technical Notes

**Code is not stable**

This repo is in a pre-release state. The public API will undergo a major refactor prior to our beta release.

# Support

**Integration Questions**

You are welcome to source-dive into the SDK and the inner `@orca-so/whirlpool-client-sdk` to interact with the Whirlpool contract. However,we will not be able to provide integration support at this moment.

**Issues / Bugs**

If you found a bug, please message the team over at @integrations on Discord.

# License

[MIT](https://choosealicense.com/licenses/mit/)
