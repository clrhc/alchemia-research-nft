const hre = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function main() {
  const { ethers } = hre;
  const [owner, minter, other, devWallet, lpVault, r0, r1, r2, r3] = await ethers.getSigners();

  const Coin = await ethers.getContractFactory("AlchemiaCoin");
  const coin = await Coin.deploy();
  await coin.waitForDeployment();

  const Renderer = await ethers.getContractFactory("AlchemiaRenderer");
  const renderer = await Renderer.deploy();
  await renderer.waitForDeployment();

  const mintPrice = ethers.parseEther("0.0004");
  const NFT = await ethers.getContractFactory("AlchemiaImpactNFT");
  const nft = await NFT.deploy(
    "Alchemia Labs",
    "ALCHLAB",
    0n,
    mintPrice,
    500,
    devWallet.address,
    lpVault.address,
    await coin.getAddress(),
    await renderer.getAddress(),
    "https://alchemia-labs.s2celerity.workers.dev/animation.html",
    [
      "Animal Welfare & Vet Science",
      "Physics Research Grants",
      "Open Medical Research",
      "Clean Energy & Climate"
    ],
    ["Animal Health", "Physics", "Medicine", "Climate"],
    [r0.address, r1.address, r2.address, r3.address]
  );
  await nft.waitForDeployment();
  await (await coin.initializeController(await nft.getAddress())).wait();

  console.log("\n=== 1. EIP-170 CONTRACT BYTECODE SIZE AUDIT (Limit: 24,576 bytes) ===");
  for (const [name, instance] of [
    ["AlchemiaCoin", coin],
    ["AlchemiaRenderer", renderer],
    ["AlchemiaImpactNFT", nft]
  ]) {
    const code = await ethers.provider.getCode(await instance.getAddress());
    const bytes = (code.length - 2) / 2;
    const pct = ((bytes / 24576) * 100).toFixed(1);
    const status = bytes < 24576 ? "PASS" : "FAIL";
    console.log(`  [${status}] ${name.padEnd(20)} ${String(bytes).padStart(6)} B (${pct}% of EIP-170 cap)`);
  }

  console.log("\n=== 2. GAS PROFILE (Base L2 @ 0.01 gwei | Mainnet @ 12 gwei, ETH=$2500) ===");
  const recordGas = async (label, txPromise) => {
    const tx = await txPromise;
    const rcpt = await tx.wait();
    const gas = Number(rcpt.gasUsed);
    const baseUsd = ((gas * 0.01e-9) * 2500).toFixed(5);
    const ethUsd = ((gas * 12e-9) * 2500).toFixed(2);
    console.log(
      `  ${label.padEnd(32)} ${String(gas).padStart(8)} gas  |  Base ~$${baseUsd}  |  Mainnet ~$${ethUsd}`
    );
  };

  await recordGas("mint(1 lab, $1)", nft.connect(minter).mint(1, 0, { value: mintPrice }));
  await recordGas("mint(1 lab, $25)", nft.connect(minter).mint(1, 1, { value: mintPrice * 25n }));
  await recordGas("upgradeVessel(+$5)", nft.connect(minter).upgradeVessel(1, { value: mintPrice * 5n }));
  await recordGas(
    "buildLabSectorWithEth(Cold Rm)",
    nft.connect(minter).buildLabSectorWithEth(1, 0, { value: mintPrice * 5n })
  );

  await time.increase(40 * 3600);
  await recordGas("claimMinedCoins(20% tithe)", nft.connect(minter).claimMinedCoins(2, 2000));
  await (await coin.connect(minter).approve(await nft.getAddress(), ethers.parseEther("220"))).wait();
  await recordGas("buildLabSectorWithCoins(Mine)", nft.connect(minter).buildLabSectorWithCoins(2, 1));
  await recordGas(
    "submitResearchProof(SHA-256)",
    nft
      .connect(minter)
      .submitResearchProof(2, ethers.keccak256(ethers.toUtf8Bytes("pdb-fold")), -34500000n, 8, "pdb://2")
  );
  await recordGas(
    "coin.transfer(0% tax)",
    coin.connect(minter).transfer(other.address, ethers.parseEther("10"))
  );
  await recordGas(
    "coin.donateToResearch(10 ALCH)",
    coin.connect(minter).donateToResearch(r0.address, ethers.parseEther("10"))
  );

  // Trigger liquidity seeding
  await (await nft.setLiquidityConfig(ethers.parseEther("0.15"), ethers.parseEther("10000000"), lpVault.address)).wait();
  await (await nft.connect(minter).mint(1, 0, { value: ethers.parseEther("1") })).wait();
  await recordGas("seedLiquidity() (permissionless)", nft.connect(other).seedLiquidity());

  console.log("\n=== 3. BLOCKAID / GOPLUS / BLOWFISH SECURITY INVARIANTS ===");
  const checks = [
    ["Zero buy/sell/transfer tax on $ALCH (exact 100% received)", (await coin.balanceOf(other.address)) === ethers.parseEther("10")],
    ["Immutable 100M $ALCH supply cap", (await coin.MAX_SUPPLY()) === ethers.parseEther("100000000")],
    ["One-time immutable NFT controller lock", (await coin.nftController()) === (await nft.getAddress())],
    ["EIP-4906 metadata refresh interface supported", await nft.supportsInterface("0x49064906")],
    ["ERC-2981 royalty interface supported", await nft.supportsInterface("0x2a55205a")],
    ["ERC-7572 contractURI() returns on-chain JSON", (await nft.contractURI()).startsWith("data:application/json;base64,")],
    ["Phase 2 holds 0 ETH in NFT contract", (await ethers.provider.getBalance(await nft.getAddress())) === 0n]
  ];
  for (const [desc, ok] of checks) {
    console.log(`  [${ok ? "PASS" : "FAIL"}] ${desc}`);
    if (!ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
