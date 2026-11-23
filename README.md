# ALCHEMIA — Living 3D Architectural Research-Mining NFTs + Zero-Tax `$ALCH` Coin

**Live Preview (Cloudflare):** https://alchemia-labs.s2celerity.workers.dev  
**Live Standalone 3D `animation_url` (Base Sepolia Lab #2):** https://alchemia-labs.s2celerity.workers.dev/animation.html?tokenId=2&seed=0x8f095d9dd6dbc542ebe57a2840d7b50a48666d94a00159b63abe3fc634bd3876&cause=1&tier=3&sectors=3&contract=0x6f6d4c12ef3b3de964e2c8c84bed4ebb8a83677f&chainId=84532

---

## Live Base Sepolia Testnet Deployment (`chainId: 84532`)

| Contract | Address |
| :--- | :--- |
| **`AlchemiaImpactNFT`** | `0x6f6D4c12EF3b3de964E2C8C84Bed4eBb8a83677F` |
| **`AlchemiaCoin ($ALCH)`** | `0x4Da32048ab4Fc630FED0ECc5a48D6cE3c31Ea382` |
| **`AlchemiaRenderer`** | `0x5Bfc9ABf9f2aA81C38a11235A85E70501Fc6EAFb` |

---

## Architecture & Key Features

- **Two-Phase Automated Funding Split & Liquidity Threshold (`contracts/AlchemiaImpactNFT.sol`)**
  - **Phase 1 (Bootstrapping `$ALCH` Liquidity):** `60%` immediately to Research Wallet · `25%` immediately to Dev Wallet · `15%` into the on-chain Liquidity Reserve until `liquidityThresholdWei` is reached, when `seedLiquidity()` pairs reserve ETH + initial `$ALCH` to the Liquidity Vault.
  - **Phase 2 (Post-Liquidity):** Automatically shifts to `66.67%` immediate Research / `33.33%` immediate Dev (`0 ETH` held in contract).
- **Zero-Tax, Blockaid-Safe `$ALCH` Coin (`contracts/AlchemiaCoin.sol`)**
  - Pure OpenZeppelin `ERC20` + `ERC20Burnable` + `ERC20Permit` with `0%` buy/sell/transfer tax, no blacklists, no pause switches, immutable `100,000,000 ALCH` max supply, one-time locked controller (`initializeController`), and standard `approve` + `burnFrom`.
- **Capped or Infinite Supply**
  - Deploy with `MAX_SUPPLY=0` for open-edition infinite supply or set a hard cap; lock forever on-chain with `lockSupplyConfig()`.
- **Real Open-Science Compute Per NFT (`web/src/engine/researchCompute.ts`)**
  - Runs Stillinger 3D Off-Lattice AB-Model Protein Folding right inside every NFT, exports standard `.PDB` Protein Data Bank files (PyMOL / ChimeraX / Mol*), hashes results with Web Crypto `SHA-256`, and anchors proofs on-chain via `submitResearchProof(...)`.
- **Interactive 3D Architectural Model + Sims-Style Lab Builder + Tamagotchi Care (`web/src/engine/alchemy3DRenderer.ts`)**
  - Three.js PBR studio scale model with 360° orbit controls, 5 progressive complexity tiers (`$1` → `$500` slider; `$1` already grand), 6 buildable 3D architectural wings (`My Labs`), live `$ALCH` mining with optional researcher tithes, and cozy Tamagotchi care (`Feed`, `Pet`, `Play Proton`) for the 3D cat/dog companions.
- **Pure-White Silvery Glassmorphic UI + Living Cursor-Painted Background**
  - Ultra-clean main Mint page with `$1` → `$500` slider, `Explore` gallery + Single NFT live `animation_url` view, `My Labs` Sims-style builder, and `White Paper` pinned at the bottom.

---

## Collaborator Quick Start

```bash
# Install dependencies
npm install
npm --prefix web install

# Compile Solidity & run unit tests
npm run compile
npm test

# Run website locally (auto-connected to Base Sepolia contracts)
npm run web:dev

# Build & deploy to Cloudflare
npm run web:build
npx wrangler deploy
```

To deploy fresh contracts to **Base Sepolia** or **Ethereum Mainnet**, copy `.env.example` to `.env`, set `DEPLOYER_PRIVATE_KEY` and verified payout/liquidity vault wallets, and run `npm run deploy:base-sepolia` or `npm run deploy:mainnet`.
