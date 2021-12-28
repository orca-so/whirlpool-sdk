export type Whirlpool = {
  version: "0.0.0";
  name: "whirlpool";
  instructions: [
    {
      name: "initializeConfig";
      accounts: [
        {
          name: "config";
          isMut: true;
          isSigner: true;
        },
        {
          name: "funder";
          isMut: false;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "feeAuthority";
          type: "publicKey";
        },
        {
          name: "collectProtocolFeesAuthority";
          type: "publicKey";
        },
        {
          name: "rewardEmissionsSuperAuthority";
          type: "publicKey";
        },
        {
          name: "doubleHopFeeDiscount";
          type: "u16";
        },
        {
          name: "defaultFeeRate";
          type: "u16";
        },
        {
          name: "defaultProtocolFeeRate";
          type: "u16";
        }
      ];
    },
    {
      name: "initializePool";
      accounts: [
        {
          name: "whirlpoolsConfig";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenMintA";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenMintB";
          isMut: false;
          isSigner: false;
        },
        {
          name: "funder";
          isMut: false;
          isSigner: true;
        },
        {
          name: "whirlpool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "bumps";
          type: {
            defined: "WhirlpoolBumps";
          };
        },
        {
          name: "initialSqrtPrice";
          type: "u128";
        },
        {
          name: "tickSpacing";
          type: {
            defined: "TickSpacing";
          };
        }
      ];
    },
    {
      name: "initializeTickArray";
      accounts: [
        {
          name: "whirlpool";
          isMut: false;
          isSigner: false;
        },
        {
          name: "funder";
          isMut: false;
          isSigner: true;
        },
        {
          name: "tickArray";
          isMut: true;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "startTickIndex";
          type: "i32";
        }
      ];
    },
    {
      name: "openPosition";
      accounts: [
        {
          name: "funder";
          isMut: false;
          isSigner: true;
        },
        {
          name: "owner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "position";
          isMut: true;
          isSigner: false;
        },
        {
          name: "positionMint";
          isMut: true;
          isSigner: true;
        },
        {
          name: "positionTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "whirlpool";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "bumps";
          type: {
            defined: "OpenPositionBumps";
          };
        },
        {
          name: "tickLowerIndex";
          type: "i32";
        },
        {
          name: "tickUpperIndex";
          type: "i32";
        }
      ];
    },
    {
      name: "increaseLiquidity";
      accounts: [
        {
          name: "whirlpool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "positionAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "position";
          isMut: true;
          isSigner: false;
        },
        {
          name: "positionTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenOwnerAccountA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenOwnerAccountB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tickArrayLower";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tickArrayUpper";
          isMut: true;
          isSigner: false;
        },
        {
          name: "clock";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "liquidityAmount";
          type: "u64";
        },
        {
          name: "tokenMaxA";
          type: "u64";
        },
        {
          name: "tokenMaxB";
          type: "u64";
        }
      ];
    },
    {
      name: "decreaseLiquidity";
      accounts: [
        {
          name: "whirlpool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "positionAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "position";
          isMut: true;
          isSigner: false;
        },
        {
          name: "positionTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenOwnerAccountA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenOwnerAccountB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tickArrayLower";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tickArrayUpper";
          isMut: true;
          isSigner: false;
        },
        {
          name: "clock";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "liquidityAmount";
          type: "u64";
        },
        {
          name: "tokenMaxA";
          type: "u64";
        },
        {
          name: "tokenMaxB";
          type: "u64";
        }
      ];
    },
    {
      name: "collect";
      accounts: [
        {
          name: "positionAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "whirlpool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "position";
          isMut: true;
          isSigner: false;
        },
        {
          name: "positionTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenOwnerAccountA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenOwnerAccountB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tickArray";
          isMut: true;
          isSigner: false;
        },
        {
          name: "secondTickArray";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "swap";
      accounts: [
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "whirlpool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenOwnerAccountA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenOwnerAccountB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenVaultB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tickArray0";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tickArray1";
          isMut: true;
          isSigner: false;
        },
        {
          name: "clock";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
        {
          name: "sqrtPriceLimit";
          type: "u128";
        },
        {
          name: "exactInput";
          type: "bool";
        },
        {
          name: "aToB";
          type: "bool";
        }
      ];
    },
    {
      name: "closePosition";
      accounts: [
        {
          name: "positionAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "receiver";
          isMut: false;
          isSigner: false;
        },
        {
          name: "position";
          isMut: true;
          isSigner: false;
        },
        {
          name: "positionMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "positionTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "setDefaultFeeRate";
      accounts: [
        {
          name: "whirlpoolsConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeAuthority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "defaultFeeRate";
          type: "u16";
        }
      ];
    },
    {
      name: "setDefaultProtocolFeeRate";
      accounts: [
        {
          name: "whirlpoolsConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeAuthority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "defaultProtocolFeeRate";
          type: "u16";
        }
      ];
    },
    {
      name: "setDoubleHopFeeDiscount";
      accounts: [
        {
          name: "whirlpoolsConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeAuthority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "doubleHopFeeDiscount";
          type: "u16";
        }
      ];
    },
    {
      name: "setFeeRate";
      accounts: [
        {
          name: "whirlpoolsConfig";
          isMut: false;
          isSigner: false;
        },
        {
          name: "whirlpool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeAuthority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "feeRate";
          type: "u16";
        }
      ];
    },
    {
      name: "setProtocolFeeRate";
      accounts: [
        {
          name: "whirlpoolsConfig";
          isMut: false;
          isSigner: false;
        },
        {
          name: "whirlpool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeAuthority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "protocolFeeRate";
          type: "u16";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "whirlpoolsConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "feeAuthority";
            type: "publicKey";
          },
          {
            name: "collectProtocolFeesAuthority";
            type: "publicKey";
          },
          {
            name: "rewardEmissionsSuperAuthority";
            type: "publicKey";
          },
          {
            name: "doubleHopFeeDiscount";
            type: "u16";
          },
          {
            name: "defaultFeeRate";
            type: "u16";
          },
          {
            name: "defaultProtocolFeeRate";
            type: "u16";
          }
        ];
      };
    },
    {
      name: "position";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whirlpool";
            type: "publicKey";
          },
          {
            name: "positionMint";
            type: "publicKey";
          },
          {
            name: "liquidity";
            type: "u64";
          },
          {
            name: "tickLowerIndex";
            type: "i32";
          },
          {
            name: "tickUpperIndex";
            type: "i32";
          },
          {
            name: "feeGrowthCheckpointA";
            type: "u128";
          },
          {
            name: "feeOwedA";
            type: "u64";
          },
          {
            name: "feeGrowthCheckpointB";
            type: "u128";
          },
          {
            name: "feeOwedB";
            type: "u64";
          },
          {
            name: "rewardInfos";
            type: {
              array: [
                {
                  defined: "PositionRewardInfo";
                },
                3
              ];
            };
          }
        ];
      };
    },
    {
      name: "tickArray";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whirlpool";
            type: "publicKey";
          },
          {
            name: "startTickIndex";
            type: "i32";
          },
          {
            name: "ticks";
            type: {
              array: [
                {
                  defined: "Tick";
                },
                72
              ];
            };
          }
        ];
      };
    },
    {
      name: "whirlpool";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whirlpoolsConfig";
            type: "publicKey";
          },
          {
            name: "whirlpoolBump";
            type: {
              array: ["u8", 1];
            };
          },
          {
            name: "tickSpacing";
            type: "u8";
          },
          {
            name: "feeRate";
            type: "u16";
          },
          {
            name: "protocolFeeRate";
            type: "u16";
          },
          {
            name: "liquidity";
            type: "u64";
          },
          {
            name: "sqrtPrice";
            type: "u128";
          },
          {
            name: "tickCurrentIndex";
            type: "i32";
          },
          {
            name: "protocolFeeOwedA";
            type: "u64";
          },
          {
            name: "protocolFeeOwedB";
            type: "u64";
          },
          {
            name: "tokenMintA";
            type: "publicKey";
          },
          {
            name: "tokenVaultA";
            type: "publicKey";
          },
          {
            name: "feeGrowthGlobalA";
            type: "u128";
          },
          {
            name: "tokenMintB";
            type: "publicKey";
          },
          {
            name: "tokenVaultB";
            type: "publicKey";
          },
          {
            name: "feeGrowthGlobalB";
            type: "u128";
          },
          {
            name: "rewardLastUpdatedTimestamp";
            type: "u64";
          },
          {
            name: "rewardInfos";
            type: {
              array: [
                {
                  defined: "WhirlpoolRewardInfo";
                },
                3
              ];
            };
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "OpenPositionBumps";
      type: {
        kind: "struct";
        fields: [
          {
            name: "positionBump";
            type: "u8";
          },
          {
            name: "positionTokenAccountBump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "PositionRewardInfo";
      type: {
        kind: "struct";
        fields: [
          {
            name: "growthInsideCheckpoint";
            type: "u128";
          },
          {
            name: "amountOwed";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "Tick";
      type: {
        kind: "struct";
        fields: [
          {
            name: "index";
            type: "i32";
          },
          {
            name: "initialized";
            type: "bool";
          },
          {
            name: "liquidityNet";
            type: "i64";
          },
          {
            name: "liquidityGross";
            type: "u64";
          },
          {
            name: "feeGrowthOutsideA";
            type: "u128";
          },
          {
            name: "feeGrowthOutsideB";
            type: "u128";
          },
          {
            name: "rewardGrowthsOutside";
            type: {
              array: ["u128", 3];
            };
          },
          {
            name: "padding1";
            type: "u128";
          },
          {
            name: "padding2";
            type: "u128";
          },
          {
            name: "padding3";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "WhirlpoolRewardInfo";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "publicKey";
          },
          {
            name: "vault";
            type: "publicKey";
          },
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "emissionsPerSecondX64";
            type: "u128";
          },
          {
            name: "growthGlobalX64";
            type: "u128";
          }
        ];
      };
    },
    {
      name: "WhirlpoolBumps";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whirlpoolBump";
            type: "u8";
          },
          {
            name: "vaultABump";
            type: "u8";
          },
          {
            name: "vaultBBump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "TickSpacing";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Stable";
          },
          {
            name: "Standard";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 300;
      name: "InvalidEnum";
      msg: "Enum value could not be converted";
    },
    {
      code: 301;
      name: "InvalidStartTick";
      msg: "Invalid start tick index provided.";
    },
    {
      code: 302;
      name: "ClosePositionNotEmpty";
      msg: "Position is not empty It cannot be closed";
    },
    {
      code: 303;
      name: "DivideByZero";
      msg: "Unable to divide by zero";
    },
    {
      code: 304;
      name: "NumberCastError";
      msg: "Unable to cast number into BigInt";
    },
    {
      code: 305;
      name: "NumberDownCastError";
      msg: "Unable to down cast number";
    },
    {
      code: 306;
      name: "TickNotFound";
      msg: "Tick not found within tick array";
    },
    {
      code: 307;
      name: "TickOutOfBounds";
      msg: "Provided tick index out of bounds";
    },
    {
      code: 308;
      name: "SqrtPriceOutOfBounds";
      msg: "Provided sqrt price out of bounds";
    },
    {
      code: 309;
      name: "LiquidityZero";
      msg: "Liquidity amount must be greater than zero";
    },
    {
      code: 310;
      name: "LiquidityTooHigh";
      msg: "Liquidity amount must be less than i64::MAX";
    },
    {
      code: 311;
      name: "LiquidityOverflow";
      msg: "Liquidity overflow";
    },
    {
      code: 312;
      name: "LiquidityUnderflow";
      msg: "Liquidity underflow";
    },
    {
      code: 313;
      name: "LiquidityNetError";
      msg: "Tick liquidity net underflowed or overflowed";
    },
    {
      code: 314;
      name: "TokenMaxExceeded";
      msg: "Exceeded token max";
    },
    {
      code: 315;
      name: "TokenMinNotMet";
      msg: "Did not meet token min";
    },
    {
      code: 316;
      name: "MissingOrInvalidDelegate";
      msg: "Position token account has a missing or invalid delegate";
    },
    {
      code: 317;
      name: "InvalidPositionTokenAmount";
      msg: "Position token amount must be 1";
    },
    {
      code: 318;
      name: "InvalidTimestampConversion";
      msg: "Timestamp should be convertible from i64 to u64";
    },
    {
      code: 319;
      name: "InvalidTimestamp";
      msg: "Timestamp should be greater than the last updated timestamp";
    }
  ];
};

export const IDL: Whirlpool = {
  version: "0.0.0",
  name: "whirlpool",
  instructions: [
    {
      name: "initializeConfig",
      accounts: [
        {
          name: "config",
          isMut: true,
          isSigner: true,
        },
        {
          name: "funder",
          isMut: false,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "feeAuthority",
          type: "publicKey",
        },
        {
          name: "collectProtocolFeesAuthority",
          type: "publicKey",
        },
        {
          name: "rewardEmissionsSuperAuthority",
          type: "publicKey",
        },
        {
          name: "doubleHopFeeDiscount",
          type: "u16",
        },
        {
          name: "defaultFeeRate",
          type: "u16",
        },
        {
          name: "defaultProtocolFeeRate",
          type: "u16",
        },
      ],
    },
    {
      name: "initializePool",
      accounts: [
        {
          name: "whirlpoolsConfig",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenMintA",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenMintB",
          isMut: false,
          isSigner: false,
        },
        {
          name: "funder",
          isMut: false,
          isSigner: true,
        },
        {
          name: "whirlpool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "bumps",
          type: {
            defined: "WhirlpoolBumps",
          },
        },
        {
          name: "initialSqrtPrice",
          type: "u128",
        },
        {
          name: "tickSpacing",
          type: {
            defined: "TickSpacing",
          },
        },
      ],
    },
    {
      name: "initializeTickArray",
      accounts: [
        {
          name: "whirlpool",
          isMut: false,
          isSigner: false,
        },
        {
          name: "funder",
          isMut: false,
          isSigner: true,
        },
        {
          name: "tickArray",
          isMut: true,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "startTickIndex",
          type: "i32",
        },
      ],
    },
    {
      name: "openPosition",
      accounts: [
        {
          name: "funder",
          isMut: false,
          isSigner: true,
        },
        {
          name: "owner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "position",
          isMut: true,
          isSigner: false,
        },
        {
          name: "positionMint",
          isMut: true,
          isSigner: true,
        },
        {
          name: "positionTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "whirlpool",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "bumps",
          type: {
            defined: "OpenPositionBumps",
          },
        },
        {
          name: "tickLowerIndex",
          type: "i32",
        },
        {
          name: "tickUpperIndex",
          type: "i32",
        },
      ],
    },
    {
      name: "increaseLiquidity",
      accounts: [
        {
          name: "whirlpool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "positionAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "position",
          isMut: true,
          isSigner: false,
        },
        {
          name: "positionTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenOwnerAccountA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenOwnerAccountB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tickArrayLower",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tickArrayUpper",
          isMut: true,
          isSigner: false,
        },
        {
          name: "clock",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "liquidityAmount",
          type: "u64",
        },
        {
          name: "tokenMaxA",
          type: "u64",
        },
        {
          name: "tokenMaxB",
          type: "u64",
        },
      ],
    },
    {
      name: "decreaseLiquidity",
      accounts: [
        {
          name: "whirlpool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "positionAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "position",
          isMut: true,
          isSigner: false,
        },
        {
          name: "positionTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenOwnerAccountA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenOwnerAccountB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tickArrayLower",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tickArrayUpper",
          isMut: true,
          isSigner: false,
        },
        {
          name: "clock",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "liquidityAmount",
          type: "u64",
        },
        {
          name: "tokenMaxA",
          type: "u64",
        },
        {
          name: "tokenMaxB",
          type: "u64",
        },
      ],
    },
    {
      name: "collect",
      accounts: [
        {
          name: "positionAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "whirlpool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "position",
          isMut: true,
          isSigner: false,
        },
        {
          name: "positionTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenOwnerAccountA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenOwnerAccountB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tickArray",
          isMut: true,
          isSigner: false,
        },
        {
          name: "secondTickArray",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "swap",
      accounts: [
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "whirlpool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenOwnerAccountA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenOwnerAccountB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenVaultB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tickArray0",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tickArray1",
          isMut: true,
          isSigner: false,
        },
        {
          name: "clock",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
        {
          name: "sqrtPriceLimit",
          type: "u128",
        },
        {
          name: "exactInput",
          type: "bool",
        },
        {
          name: "aToB",
          type: "bool",
        },
      ],
    },
    {
      name: "closePosition",
      accounts: [
        {
          name: "positionAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "receiver",
          isMut: false,
          isSigner: false,
        },
        {
          name: "position",
          isMut: true,
          isSigner: false,
        },
        {
          name: "positionMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "positionTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "setDefaultFeeRate",
      accounts: [
        {
          name: "whirlpoolsConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "defaultFeeRate",
          type: "u16",
        },
      ],
    },
    {
      name: "setDefaultProtocolFeeRate",
      accounts: [
        {
          name: "whirlpoolsConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "defaultProtocolFeeRate",
          type: "u16",
        },
      ],
    },
    {
      name: "setDoubleHopFeeDiscount",
      accounts: [
        {
          name: "whirlpoolsConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "doubleHopFeeDiscount",
          type: "u16",
        },
      ],
    },
    {
      name: "setFeeRate",
      accounts: [
        {
          name: "whirlpoolsConfig",
          isMut: false,
          isSigner: false,
        },
        {
          name: "whirlpool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "feeRate",
          type: "u16",
        },
      ],
    },
    {
      name: "setProtocolFeeRate",
      accounts: [
        {
          name: "whirlpoolsConfig",
          isMut: false,
          isSigner: false,
        },
        {
          name: "whirlpool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "protocolFeeRate",
          type: "u16",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "whirlpoolsConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "feeAuthority",
            type: "publicKey",
          },
          {
            name: "collectProtocolFeesAuthority",
            type: "publicKey",
          },
          {
            name: "rewardEmissionsSuperAuthority",
            type: "publicKey",
          },
          {
            name: "doubleHopFeeDiscount",
            type: "u16",
          },
          {
            name: "defaultFeeRate",
            type: "u16",
          },
          {
            name: "defaultProtocolFeeRate",
            type: "u16",
          },
        ],
      },
    },
    {
      name: "position",
      type: {
        kind: "struct",
        fields: [
          {
            name: "whirlpool",
            type: "publicKey",
          },
          {
            name: "positionMint",
            type: "publicKey",
          },
          {
            name: "liquidity",
            type: "u64",
          },
          {
            name: "tickLowerIndex",
            type: "i32",
          },
          {
            name: "tickUpperIndex",
            type: "i32",
          },
          {
            name: "feeGrowthCheckpointA",
            type: "u128",
          },
          {
            name: "feeOwedA",
            type: "u64",
          },
          {
            name: "feeGrowthCheckpointB",
            type: "u128",
          },
          {
            name: "feeOwedB",
            type: "u64",
          },
          {
            name: "rewardInfos",
            type: {
              array: [
                {
                  defined: "PositionRewardInfo",
                },
                3,
              ],
            },
          },
        ],
      },
    },
    {
      name: "tickArray",
      type: {
        kind: "struct",
        fields: [
          {
            name: "whirlpool",
            type: "publicKey",
          },
          {
            name: "startTickIndex",
            type: "i32",
          },
          {
            name: "ticks",
            type: {
              array: [
                {
                  defined: "Tick",
                },
                72,
              ],
            },
          },
        ],
      },
    },
    {
      name: "whirlpool",
      type: {
        kind: "struct",
        fields: [
          {
            name: "whirlpoolsConfig",
            type: "publicKey",
          },
          {
            name: "whirlpoolBump",
            type: {
              array: ["u8", 1],
            },
          },
          {
            name: "tickSpacing",
            type: "u8",
          },
          {
            name: "feeRate",
            type: "u16",
          },
          {
            name: "protocolFeeRate",
            type: "u16",
          },
          {
            name: "liquidity",
            type: "u64",
          },
          {
            name: "sqrtPrice",
            type: "u128",
          },
          {
            name: "tickCurrentIndex",
            type: "i32",
          },
          {
            name: "protocolFeeOwedA",
            type: "u64",
          },
          {
            name: "protocolFeeOwedB",
            type: "u64",
          },
          {
            name: "tokenMintA",
            type: "publicKey",
          },
          {
            name: "tokenVaultA",
            type: "publicKey",
          },
          {
            name: "feeGrowthGlobalA",
            type: "u128",
          },
          {
            name: "tokenMintB",
            type: "publicKey",
          },
          {
            name: "tokenVaultB",
            type: "publicKey",
          },
          {
            name: "feeGrowthGlobalB",
            type: "u128",
          },
          {
            name: "rewardLastUpdatedTimestamp",
            type: "u64",
          },
          {
            name: "rewardInfos",
            type: {
              array: [
                {
                  defined: "WhirlpoolRewardInfo",
                },
                3,
              ],
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "OpenPositionBumps",
      type: {
        kind: "struct",
        fields: [
          {
            name: "positionBump",
            type: "u8",
          },
          {
            name: "positionTokenAccountBump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "PositionRewardInfo",
      type: {
        kind: "struct",
        fields: [
          {
            name: "growthInsideCheckpoint",
            type: "u128",
          },
          {
            name: "amountOwed",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "Tick",
      type: {
        kind: "struct",
        fields: [
          {
            name: "index",
            type: "i32",
          },
          {
            name: "initialized",
            type: "bool",
          },
          {
            name: "liquidityNet",
            type: "i64",
          },
          {
            name: "liquidityGross",
            type: "u64",
          },
          {
            name: "feeGrowthOutsideA",
            type: "u128",
          },
          {
            name: "feeGrowthOutsideB",
            type: "u128",
          },
          {
            name: "rewardGrowthsOutside",
            type: {
              array: ["u128", 3],
            },
          },
          {
            name: "padding1",
            type: "u128",
          },
          {
            name: "padding2",
            type: "u128",
          },
          {
            name: "padding3",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "WhirlpoolRewardInfo",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mint",
            type: "publicKey",
          },
          {
            name: "vault",
            type: "publicKey",
          },
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "emissionsPerSecondX64",
            type: "u128",
          },
          {
            name: "growthGlobalX64",
            type: "u128",
          },
        ],
      },
    },
    {
      name: "WhirlpoolBumps",
      type: {
        kind: "struct",
        fields: [
          {
            name: "whirlpoolBump",
            type: "u8",
          },
          {
            name: "vaultABump",
            type: "u8",
          },
          {
            name: "vaultBBump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "TickSpacing",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Stable",
          },
          {
            name: "Standard",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 300,
      name: "InvalidEnum",
      msg: "Enum value could not be converted",
    },
    {
      code: 301,
      name: "InvalidStartTick",
      msg: "Invalid start tick index provided.",
    },
    {
      code: 302,
      name: "ClosePositionNotEmpty",
      msg: "Position is not empty It cannot be closed",
    },
    {
      code: 303,
      name: "DivideByZero",
      msg: "Unable to divide by zero",
    },
    {
      code: 304,
      name: "NumberCastError",
      msg: "Unable to cast number into BigInt",
    },
    {
      code: 305,
      name: "NumberDownCastError",
      msg: "Unable to down cast number",
    },
    {
      code: 306,
      name: "TickNotFound",
      msg: "Tick not found within tick array",
    },
    {
      code: 307,
      name: "TickOutOfBounds",
      msg: "Provided tick index out of bounds",
    },
    {
      code: 308,
      name: "SqrtPriceOutOfBounds",
      msg: "Provided sqrt price out of bounds",
    },
    {
      code: 309,
      name: "LiquidityZero",
      msg: "Liquidity amount must be greater than zero",
    },
    {
      code: 310,
      name: "LiquidityTooHigh",
      msg: "Liquidity amount must be less than i64::MAX",
    },
    {
      code: 311,
      name: "LiquidityOverflow",
      msg: "Liquidity overflow",
    },
    {
      code: 312,
      name: "LiquidityUnderflow",
      msg: "Liquidity underflow",
    },
    {
      code: 313,
      name: "LiquidityNetError",
      msg: "Tick liquidity net underflowed or overflowed",
    },
    {
      code: 314,
      name: "TokenMaxExceeded",
      msg: "Exceeded token max",
    },
    {
      code: 315,
      name: "TokenMinNotMet",
      msg: "Did not meet token min",
    },
    {
      code: 316,
      name: "MissingOrInvalidDelegate",
      msg: "Position token account has a missing or invalid delegate",
    },
    {
      code: 317,
      name: "InvalidPositionTokenAmount",
      msg: "Position token amount must be 1",
    },
    {
      code: 318,
      name: "InvalidTimestampConversion",
      msg: "Timestamp should be convertible from i64 to u64",
    },
    {
      code: 319,
      name: "InvalidTimestamp",
      msg: "Timestamp should be greater than the last updated timestamp",
    },
  ],
};
