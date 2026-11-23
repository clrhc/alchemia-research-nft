# ALCHEMIA — 3D Labs That Fund Science

**Live Site (Cloudflare):** https://alchemia-labs.s2celerity.workers.dev  
**Interactive 3D Lab View (`animation_url`):** https://alchemia-labs.s2celerity.workers.dev/animation.html?tokenId=2&seed=0x8f095d9dd6dbc542ebe57a2840d7b50a48666d94a00159b63abe3fc634bd3876&cause=1&tier=3&sectors=3&contract=0x6f6d4c12ef3b3de964e2c8c84bed4ebb8a83677f&chainId=84532

---

## Live Base Sepolia Contracts (`chainId: 84532`)

| Contract | Address |
| :--- | :--- |
| **`AlchemiaImpactNFT`** | `0x6f6D4c12EF3b3de964E2C8C84Bed4eBb8a83677F` |
| **`AlchemiaCoin ($ALCH)`** | `0x4Da32048ab4Fc630FED0ECc5a48D6cE3c31Ea382` |
| **`AlchemiaRenderer`** | `0x5Bfc9ABf9f2aA81C38a11235A85E70501Fc6EAFb` |

---

## What It Does

- **Pay-What-You-Want Single 3D Lab ($1 → $500 Slider)**
  - Start at `$1` for a full 3D architectural glass lab. Slide higher to add detail on one NFT (dual condensers, celestial rings, Cat & Dog pair, 4D crystal crown), or upgrade an existing NFT later on-chain via `upgradeVessel()`.
- **Two-Phase Automated Split (`contracts/AlchemiaImpactNFT.sol`)**
  - **Phase 1 (Bootstrapping `$ALCH` liquidity):** `60%` straight to the research wallet, `25%` straight to the dev wallet, and `15%` into the on-chain liquidity reserve until `liquidityThresholdWei` is reached, when `seedLiquidity()` pairs reserve ETH with `$ALCH` to the liquidity vault.
  - **Phase 2 (Post-liquidity):** Switches permanently to `66.67%` immediate research / `33.33%` immediate dev (`0 ETH` held in contract).
- **Zero-Tax, Scanner-Safe `$ALCH` Coin (`contracts/AlchemiaCoin.sol`)**
  - Standard OpenZeppelin `ERC20` + `ERC20Burnable` + `ERC20Permit` (EIP-2612) with `0%` buy/sell/transfer tax, no blacklists, no pause switches, immutable `100,000,000 ALCH` cap, one-time locked controller (`initializeController`), and optional renounced ownership on mainnet launch.
- **Real Open-Science Protein Folding Per NFT (`web/src/engine/researchCompute.ts`, `structuralAnalysis.ts`)**
  - Runs an off-thread Web Worker folding 8 published fast-folding RCSB PDB mini-proteins (`1L2Y`, `1GB1`, `1UAO`, `2RVD`, `1VII`, `2F4K`, `1FME`, `2JOF`) using 20-AA Kyte-Doolittle hydropathy, salt-bridge electrostatics, aromatic stacking, P-SEA secondary structure assignment, Foldit-style `Wiggle` / `Shake` tools, and 4-replica parallel tempering.
  - Exports strict wwPDB v3.30 `.PDB` and `.CIF` (mmCIF) files for PyMOL, UCSF ChimeraX, and RCSB Mol*, plus `.JSON` science certificates and Web Crypto `SHA-256` on-chain proofs.
- **Sims-Style Buildable Rooms + Tamagotchi Pet Care (`web/src/engine/alchemy3DRenderer.ts`)**
  - Hover any of the 6 rooms (**Cold Room**, **Mining Room**, **Greenhouse**, **Pet Lounge**, **Particle Tower**, **Glass Dome**) to preview its frosted-glass architectural wireframe on your 3D building before building with `$ALCH` or ETH.
  - Feed, pet, name, and play fetch with your 3D cat or dog for up to a `1.4x` lab speed boost; tap the pet or floating protons directly in 3D for combo crystal chimes and bonus sparks.
- **Dynamic On-Chain Swiss Blueprint SVG + EIP-4906 (`contracts/AlchemiaRenderer.sol`)**
  - Emits EIP-4906 (`0x49064906`) `MetadataUpdate` events on every room build, upgrade, or research proof, supports permanent `freezeAnimationBaseUrl()` metadata locking, and renders an on-chain architectural blueprint SVG reflecting live rooms and proofs.

---

## Collaborator Quick Start

```bash
# Install dependencies
npm install
npm --prefix web install

# Compile Solidity & run Hardhat security/tokenomics tests
npm run compile
npm test

# Run frontend open-science & engine unit tests (Vitest)
npm run web:test

# Run website locally (auto-connected to Base Sepolia)
npm run web:dev

# Production build & Cloudflare deploy
npm run web:build
npx wrangler deploy
```

To deploy fresh contracts to **Base Sepolia** or **Ethereum Mainnet**, copy `.env.example` to `.env`, configure `DEPLOYER_PRIVATE_KEY` and payout/liquidity vault wallets, and run `npm run deploy:base-sepolia` or `npm run deploy:mainnet`.
