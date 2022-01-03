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
import { readFile } from "mz/fs";
import { Connection, Keypair } from "@solana/web3.js";
import { getOrca } from "@orca-so/sdk";

const main = async () => {
  /*** Setup ***/
  // 1. Read secret key file to get owner keypair
  const secretKeyString = await readFile("/Users/scuba/my-wallet/my-keypair.json", {
    encoding: "utf8",
  });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const owner = Keypair.fromSecretKey(secretKey);

  // 2. Initialzie Orca object with mainnet connection
  const connection = new Connection("https://api.mainnet-beta.solana.com", "singleGossip");
  const orca = getOrca(connection);

  try {
  } catch (err) {
    console.warn(err);
  }
};

main()
  .then(() => {
    console.log("Done");
  })
  .catch((e) => {
    console.error(e);
  });
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
