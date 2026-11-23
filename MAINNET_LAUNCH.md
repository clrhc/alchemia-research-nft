# ALCHEMIA — Mainnet & Base Launch Guide

A clear step-by-step checklist for deploying, verifying, and locking ALCHEMIA on **Base Mainnet** or **Ethereum Mainnet**.

## 1. Current Live Base Sepolia Testnet

| Component | Address / URL |
| --- | --- |
| Live Website | `https://alchemia-labs.s2celerity.workers.dev` |
| `AlchemiaImpactNFT` | `0x6f6D4c12EF3b3de964E2C8C84Bed4eBb8a83677F` |
| `AlchemiaCoin ($ALCH)` | `0x4Da32048ab4Fc630FED0ECc5a48D6cE3c31Ea382` |
| `AlchemiaRenderer` | `0x5Bfc9ABf9f2aA81C38a11235A85E70501Fc6EAFb` |

Run a live health check any time:

```bash
npm run verify:live
```

## 2. Pre-Launch Security & Gas Audit

Run the local contract test suite and automated size / gas / security audit before every deployment:

```bash
npm run compile
npm test
npm run audit
```

Key verified invariants:
- **EIP-170 Bytecode**: All 3 contracts sit comfortably under `24,576 B` (`AlchemiaCoin` ~4.5 KB, `AlchemiaRenderer` ~14.7 KB, `AlchemiaImpactNFT` ~18.7 KB).
- **Zero-Tax `$ALCH` Coin**: 0% buy / sell / transfer tax, unmodified OpenZeppelin `ERC20` + `ERC20Burnable` + `ERC20Permit` (EIP-2612), fixed `100,000,000 ALCH` cap, immutable one-time controller binding, no blacklist, no pause, no transfer hooks.
- **Marketplace Standards**: `ERC-2981` royalties, `EIP-4906` live metadata refresh on every upgrade/room build/proof anchor, and `ERC-7572` on-chain `contractURI()`.
- **Two-Phase Split**: Phase 1 routes `60%` Research / `25%` Dev / `15%` LP Reserve until `liquidityThresholdWei` is reached; once permissionless `seedLiquidity()` runs, Phase 2 permanently routes `66.67%` Research / `33.33%` Dev with `0 ETH` held in the contract.

## 3. Environment Setup (`.env`, never commit!)

Set these in the root `.env` before deploying to Base Mainnet (`8453`) or Ethereum Mainnet (`1`):

```env
DEPLOYER_PRIVATE_KEY=0x...
DEV_WALLET=0x...
LIQUIDITY_VAULT=0x...
RESEARCH_WALLET_0=0x...
RESEARCH_WALLET_1=0x...
RESEARCH_WALLET_2=0x...
RESEARCH_WALLET_3=0x...
ANIMATION_BASE_URL=https://alchemia-labs.s2celerity.workers.dev/animation.html
MAX_SUPPLY=0
MINT_PRICE_ETH=0.0004
ROYALTY_BPS=500
# Recommended on Mainnet: renounces AlchemiaCoin owner after controller locks
RENOUNCE_COIN_OWNERSHIP=true
```

## 4. Deploy & Verify

```bash
# Base Mainnet (recommended: ~$0.009 per mint)
npm run deploy:base

# Or Ethereum Mainnet
npm run deploy:mainnet
```

Verify source code on BaseScan / Etherscan immediately after deploy (verified source code prevents false positives in Blockaid, GoPlus, and Blowfish wallet scanners):

```bash
npx hardhat verify --network base <COIN_ADDRESS>
npx hardhat verify --network base <RENDERER_ADDRESS>
npx hardhat verify --network base <NFT_ADDRESS> ...constructorArgs
```

## 5. Update Frontend & Deploy to Cloudflare Workers

Update `web/.env` with the newly deployed `VITE_CONTRACT_ADDRESS`, `VITE_COIN_ADDRESS`, and `VITE_CHAIN_ID`, then build and deploy:

```bash
npm run web:test
npm run web:build
npx wrangler deploy
```

## 6. Optional Permanent Immutability Locks (Mainnet)

Once you have verified `animation.html` and your supply model live on Mainnet:
1. Call `nft.lockSupplyConfig()` to permanently freeze `maxSupply` (open or capped).
2. Call `nft.freezeAnimationBaseUrl()` to permanently lock `animationBaseUrl` so metadata can never be swapped.
3. If `RENOUNCE_COIN_OWNERSHIP=true` was not set at deploy time, call `coin.renounceOwnership()` — the immutable `nftController` continues minting lab rewards and liquidity seeding forever with zero admin keys on `$ALCH`.
