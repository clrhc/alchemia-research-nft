const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("====================================================");
  console.log("Deploying ALCHEMIA Suite ($ALCH Coin + Renderer + Impact NFT)");
  console.log("Network:  ", hre.network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  console.log("====================================================");

  const maxSupply = BigInt(process.env.MAX_SUPPLY || "0");
  const mintPriceWei = hre.ethers.parseEther(process.env.MINT_PRICE_ETH || "0.0004");
  const royaltyBps = BigInt(process.env.ROYALTY_BPS || "500");
  const animationBaseUrl =
    process.env.ANIMATION_BASE_URL ||
    "https://alchemia-labs.s2celerity.workers.dev/animation.html";

  const isMainnet = network.chainId === 1n;
  const devWallet = process.env.DEV_WALLET || (isMainnet ? "" : deployer.address);
  const liquidityVault = process.env.LIQUIDITY_VAULT || (isMainnet ? "" : deployer.address);
  const researchWallets = [
    process.env.RESEARCH_WALLET_0 || (isMainnet ? "" : deployer.address),
    process.env.RESEARCH_WALLET_1 || (isMainnet ? "" : deployer.address),
    process.env.RESEARCH_WALLET_2 || (isMainnet ? "" : deployer.address),
    process.env.RESEARCH_WALLET_3 || (isMainnet ? "" : deployer.address)
  ];

  if (isMainnet && (!devWallet || !liquidityVault || researchWallets.some((a) => !a))) {
    throw new Error(
      "Mainnet deploy requires DEV_WALLET, LIQUIDITY_VAULT, and RESEARCH_WALLET_0..3 in .env"
    );
  }

  // 1. Deploy $ALCH ERC-20 Coin
  const Coin = await hre.ethers.getContractFactory("AlchemiaCoin");
  const coin = await Coin.deploy();
  await coin.waitForDeployment();
  const coinAddr = await coin.getAddress();

  // 2. Deploy standalone on-chain SVG & Metadata Renderer
  const Renderer = await hre.ethers.getContractFactory("AlchemiaRenderer");
  const renderer = await Renderer.deploy();
  await renderer.waitForDeployment();
  const rendererAddr = await renderer.getAddress();

  // 3. Deploy AlchemiaImpactNFT linked to Coin & Renderer
  const NFT = await hre.ethers.getContractFactory("AlchemiaImpactNFT");
  const nft = await NFT.deploy(
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
  );
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();

  // 4. Permanently bind NFT contract as the sole $ALCH mining & LP seeding controller (one-time immutable)
  const tx = await coin.initializeController(nftAddr);
  await tx.wait();

  // Optional Mainnet security hardening: renounce $ALCH ownership after controller is locked
  if (process.env.RENOUNCE_COIN_OWNERSHIP === "true") {
    const renTx = await coin.renounceOwnership();
    await renTx.wait();
    console.log("AlchemiaCoin ownership renounced (immutable zero-tax & 100M cap)");
  }

  console.log("AlchemiaCoin ($ALCH):   ", coinAddr);
  console.log("AlchemiaRenderer:       ", rendererAddr);
  console.log("AlchemiaImpactNFT:      ", nftAddr);
  console.log("Phase 1 Split: 60% Research / 25% Dev / 15% $ALCH Liquidity Reserve");
  console.log("Phase 2 Split (post-LP): 66.67% Research / 33.33% Dev");
  console.log("----------------------------------------------------");
  console.log(`VITE_CONTRACT_ADDRESS=${nftAddr}`);
  console.log(`VITE_COIN_ADDRESS=${coinAddr}`);
  console.log(`VITE_CHAIN_ID=${network.chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
