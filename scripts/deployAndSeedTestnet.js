const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  if (network.chainId === 1n || network.chainId === 8453n) {
    throw new Error("Refusing to run testnet seed script on a mainnet chain!");
  }

  console.log("====================================================");
  console.log("Deploying & Seeding ALCHEMIA V2 Suite on Testnet");
  console.log("Network:  ", hre.network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("====================================================");

  const mintPriceWei = ethers.parseEther(process.env.MINT_PRICE_ETH || "0.0004");
  const animationBaseUrl =
    process.env.ANIMATION_BASE_URL ||
    "https://alchemia-labs.s2celerity.workers.dev/animation.html";

  // 1. Deploy $ALCH ERC-20 Coin
  const Coin = await ethers.getContractFactory("AlchemiaCoin");
  const coin = await Coin.deploy();
  await coin.waitForDeployment();
  const coinAddr = await coin.getAddress();

  // 2. Deploy V2 AlchemiaRenderer (Districts, Multi-Story Estates, Gardens, Supply URLs)
  const Renderer = await ethers.getContractFactory("AlchemiaRenderer");
  const renderer = await Renderer.deploy();
  await renderer.waitForDeployment();
  const rendererAddr = await renderer.getAddress();

  // 3. Deploy V2 AlchemiaImpactNFT
  const NFT = await ethers.getContractFactory("AlchemiaImpactNFT");
  const nft = await NFT.deploy(
    "Alchemia Labs",
    "ALCHLAB",
    0n,
    mintPriceWei,
    500,
    deployer.address,
    deployer.address,
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
    [deployer.address, deployer.address, deployer.address, deployer.address]
  );
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();

  // 4. Permanently bind NFT controller
  await (await coin.initializeController(nftAddr)).wait();

  // 5. Seed 4 live pioneer labs across all 4 science causes so the Testnet Town is alive immediately!
  await (await nft.mint(1, 0, { value: mintPriceWei * 25n })).wait(); // Lab #1 ($25 Tier 3)
  await (await nft.mint(1, 1, { value: mintPriceWei * 5n })).wait();  // Lab #2 ($5 Tier 2)
  await (await nft.mint(1, 2, { value: mintPriceWei * 100n })).wait(); // Lab #3 ($100 Tier 4)
  await (await nft.mint(1, 3, { value: mintPriceWei })).wait();       // Lab #4 ($1 Tier 1)

  // Build 2 Lab Wings + Expand Estate (3F Penthouse + Cozy Bedroom & Conservatory) + Anchor 1 fold on Lab #1!
  await (await nft.buildLabSectorWithEth(1, 0, { value: mintPriceWei * 5n })).wait();
  await (await nft.buildLabSectorWithEth(1, 1, { value: mintPriceWei * 5n })).wait();
  await (
    await nft.expandEstateWithEth(1, 2, 3, true, 0b001001, { value: mintPriceWei * 8n })
  ).wait();
  await (
    await nft.syncEstateCustomization(1, 0x0001020304n, 6, "")
  ).wait();
  const seedProof = ethers.keccak256(ethers.toUtf8Bytes("ALCHEMIA-V2-BASE-SEPOLIA-1L2Y-GENESIS"));
  await (await nft.submitResearchProof(1, seedProof, -19450000n, 8, "pdb://1L2Y/genesis")).wait();

  const summary = await nft.townGrowthSummary();
  console.log("AlchemiaCoin ($ALCH):   ", coinAddr);
  console.log("AlchemiaRenderer V2:    ", rendererAddr);
  console.log("AlchemiaImpactNFT V2:   ", nftAddr);
  console.log("Seeded Town Supply:     ", summary.mintedLabs.toString(), "labs (Stage", summary.townStage.toString() + ")");
  console.log("----------------------------------------------------");
  console.log(`VITE_CONTRACT_ADDRESS=${nftAddr}`);
  console.log(`VITE_COIN_ADDRESS=${coinAddr}`);
  console.log(`VITE_CHAIN_ID=${network.chainId}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
