const hre = require("hardhat");
require("dotenv").config();

/**
 * One-command BaseScan / Etherscan source-code verification helper.
 * Verified source code prevents false positives in Blockaid, GoPlus, and Blowfish scanners.
 *
 * Usage:
 *   COIN_ADDRESS=0x... RENDERER_ADDRESS=0x... NFT_ADDRESS=0x... npx hardhat run scripts/verifyBasescan.js --network baseSepolia
 */
async function verifySafe(address, constructorArguments, label) {
  try {
    await hre.run("verify:verify", { address, constructorArguments });
    console.log(`[VERIFIED] ${label}: ${address}`);
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes("already verified")) {
      console.log(`[OK] ${label} already verified: ${address}`);
    } else {
      console.error(`[WARN] ${label} verification failed:`, msg);
    }
  }
}

async function main() {
  const coinAddr = process.env.COIN_ADDRESS || "0x4Da32048ab4Fc630FED0ECc5a48D6cE3c31Ea382";
  const rendererAddr = process.env.RENDERER_ADDRESS || "0x5Bfc9ABf9f2aA81C38a11235A85E70501Fc6EAFb";
  const nftAddr = process.env.NFT_ADDRESS || "0x6f6D4c12EF3b3de964E2C8C84Bed4eBb8a83677F";

  const [deployer] = await hre.ethers.getSigners();
  const maxSupply = BigInt(process.env.MAX_SUPPLY || "0");
  const mintPriceWei = hre.ethers.parseEther(process.env.MINT_PRICE_ETH || "0.0004");
  const royaltyBps = BigInt(process.env.ROYALTY_BPS || "500");
  const devWallet = process.env.DEV_WALLET || deployer.address;
  const liquidityVault = process.env.LIQUIDITY_VAULT || deployer.address;
  const animationBaseUrl =
    process.env.ANIMATION_BASE_URL || "https://alchemia-labs.s2celerity.workers.dev/animation.html";
  const researchWallets = [
    process.env.RESEARCH_WALLET_0 || deployer.address,
    process.env.RESEARCH_WALLET_1 || deployer.address,
    process.env.RESEARCH_WALLET_2 || deployer.address,
    process.env.RESEARCH_WALLET_3 || deployer.address
  ];

  await verifySafe(coinAddr, [], "AlchemiaCoin ($ALCH)");
  await verifySafe(rendererAddr, [], "AlchemiaRenderer");
  await verifySafe(
    nftAddr,
    [
      "Alchemia Labs",
      "ALCHLAB",
      maxSupply,
      mintPriceWei,
      royaltyBps,
      devWallet,
      liquidityVault,
      coinAddr,
      rendererAddr,
      animationBaseUrl,
      [
        "Animal Welfare & Vet Science",
        "Physics Research Grants",
        "Open Medical Research",
        "Clean Energy & Climate"
      ],
      ["Animal Health", "Physics", "Medicine", "Climate"],
      researchWallets
    ],
    "AlchemiaImpactNFT"
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
