const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Alchemia Ecosystem ($ALCH Coin + Liquidity Threshold + Sims-Style Lab Sectors + Research Proofs)", function () {
  async function deployFixture(initialMaxSupply = 0n) {
    const [owner, minter, devWallet, lpVault, research0, research1, research2, research3] =
      await ethers.getSigners();

    const Coin = await ethers.getContractFactory("AlchemiaCoin");
    const coin = await Coin.deploy();
    await coin.waitForDeployment();

    const Renderer = await ethers.getContractFactory("AlchemiaRenderer");
    const renderer = await Renderer.deploy();
    await renderer.waitForDeployment();

    const mintPrice = ethers.parseEther("0.0004"); // ~$1 USD
    const NFT = await ethers.getContractFactory("AlchemiaImpactNFT");
    const contract = await NFT.deploy(
      "Alchemia Labs",
      "ALCHLAB",
      initialMaxSupply,
      mintPrice,
      500,
      devWallet.address,
      lpVault.address,
      await coin.getAddress(),
      await renderer.getAddress(),
      "https://alchemia.art/animation.html",
      [
        "Companion Animal Welfare & Biology",
        "Particle & Quantum Physics Grants",
        "Biomedical & Cellular Alchemy",
        "Clean Energy & Climate Catalysis"
      ],
      ["Charity", "Physics", "Biomedical", "Climate"],
      [research0.address, research1.address, research2.address, research3.address]
    );
    await contract.waitForDeployment();
    await coin.initializeController(await contract.getAddress());

    return {
      coin,
      renderer,
      contract,
      owner,
      minter,
      devWallet,
      lpVault,
      research0,
      research1,
      research2,
      research3,
      mintPrice
    };
  }

  it("Phase 1 splits 60% research / 25% dev / 15% liquidity reserve, seeds LP at threshold, then switches to 66.67% / 33.33%", async function () {
    const { coin, contract, minter, devWallet, lpVault, research0, mintPrice } = await deployFixture(0n);

    // Lower threshold in test to 0.15 ETH so we verify threshold transition cleanly
    await contract.setLiquidityConfig(ethers.parseEther("0.15"), ethers.parseEther("10000000"), lpVault.address);

    const rBefore = await ethers.provider.getBalance(research0.address);
    const dBefore = await ethers.provider.getBalance(devWallet.address);

    // Mint 1 NFT with 1.0 ETH -> 0.60 ETH immediate research, 0.25 ETH immediate dev, 0.15 ETH LP reserve!
    const amount1 = ethers.parseEther("1");
    await contract.connect(minter).mint(1, 0, { value: amount1 });

    expect(await ethers.provider.getBalance(research0.address)).to.equal(rBefore + ethers.parseEther("0.6"));
    expect(await ethers.provider.getBalance(devWallet.address)).to.equal(dBefore + ethers.parseEther("0.25"));
    expect(await contract.liquidityReserveWei()).to.equal(ethers.parseEther("0.15"));

    // Threshold reached -> seedLiquidity() sends ETH + paired $ALCH coins directly to Liquidity Vault!
    const lpEthBefore = await ethers.provider.getBalance(lpVault.address);
    await expect(contract.seedLiquidity()).to.emit(contract, "LiquiditySeeded");
    expect(await contract.liquiditySeeded()).to.equal(true);
    expect(await ethers.provider.getBalance(lpVault.address)).to.equal(lpEthBefore + ethers.parseEther("0.15"));
    expect(await coin.balanceOf(lpVault.address)).to.equal(ethers.parseEther("10000000"));

    // Phase 2 (Post-Liquidity): immediately splits 66.67% Research / 33.33% Dev with 0 ETH held in contract!
    const rPhase2Before = await ethers.provider.getBalance(research0.address);
    const dPhase2Before = await ethers.provider.getBalance(devWallet.address);

    await contract.connect(minter).mint(1, 0, { value: mintPrice * 10n });
    const base2 = mintPrice * 10n;
    const expectedDev2 = (base2 * 3333n) / 10000n;
    const expectedRes2 = base2 - expectedDev2;

    expect(await ethers.provider.getBalance(research0.address)).to.equal(rPhase2Before + expectedRes2);
    expect(await ethers.provider.getBalance(devWallet.address)).to.equal(dPhase2Before + expectedDev2);
    expect(await ethers.provider.getBalance(await contract.getAddress())).to.equal(0n);
  });

  it("runs $ALCH mining game, allows donating mined coins to researchers, and builds Sims-style 3D lab sectors", async function () {
    const { coin, contract, minter, research0, mintPrice } = await deployFixture(0n);

    // Mint a Tier 3 ($25) lab -> base mining rate = 15 ALCH/hour
    await contract.connect(minter).mint(1, 0, { value: mintPrice * 25n });
    expect(await contract.miningRatePerHourOf(1)).to.equal(ethers.parseEther("15"));

    // Advance 20 hours -> 300 ALCH accrued!
    await time.increase(20 * 3600);

    // Claim with a 20% automatic tithe to the research wallet!
    await expect(contract.connect(minter).claimMinedCoins(1, 2000)).to.emit(contract, "CoinsClaimed");
    const holderBal = await coin.balanceOf(minter.address);
    const researchCoins = await coin.balanceOf(research0.address);
    expect(holderBal).to.be.gte(ethers.parseEther("239"));
    expect(researchCoins).to.be.gte(ethers.parseEther("59"));

    // Build Sector #1 (Quantum Mining Pavilion, cost 220 ALCH) using standard ERC-20 approve (Blockaid-safe!)
    await coin.connect(minter).approve(await contract.getAddress(), ethers.parseEther("220"));
    await expect(contract.connect(minter).buildLabSectorWithCoins(1, 1)).to.emit(contract, "LabSectorBuilt");

    // Verify controller is permanently immutable (cannot be re-initialized!)
    await expect(coin.initializeController(minter.address)).to.be.revertedWithCustomError(
      coin,
      "ControllerAlreadyInitialized"
    );

    // Mining rate jumps immediately from 15 ALCH/hr to 29 ALCH/hr (+14 ALCH/hr bonus)!
    expect(await contract.miningRatePerHourOf(1)).to.equal(ethers.parseEther("29"));

    // Direct $ALCH coin donation to researcher wallet
    await coin.connect(minter).donateToResearch(research0.address, ethers.parseEther("10"));
    expect(await coin.totalDonatedToResearch()).to.equal(ethers.parseEther("10"));
  });

  it("anchors verifiable SHA-256 open-science protein folding proofs and boosts mining power", async function () {
    const { contract, minter, mintPrice } = await deployFixture(0n);

    await contract.connect(minter).mint(1, 0, { value: mintPrice });
    const rateBefore = await contract.miningRatePerHourOf(1);

    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("ATOM 1 CA ALA ..."));
    await expect(
      contract.connect(minter).submitResearchProof(1, proofHash, -18450000n, 10, "ipfs://bafyfold1")
    ).to.emit(contract, "ResearchDiscoveryAnchored");

    // 10 verified Work Units adds +5 ALCH/hr mining boost!
    expect(await contract.miningRatePerHourOf(1)).to.equal(rateBefore + ethers.parseEther("5"));
    expect(await contract.totalResearchWorkUnits()).to.equal(10n);
  });

  it("renders dynamic on-chain tokenURI including complexity tier, built lab wings, and animation_url", async function () {
    const { contract, minter, mintPrice } = await deployFixture(0n);

    await contract.connect(minter).mint(1, 0, { value: mintPrice * 5n });
    await contract.connect(minter).buildLabSectorWithEth(1, 0, { value: mintPrice * 5n });

    const uri = await contract.tokenURI(1);
    const metadata = JSON.parse(
      Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8")
    );

    expect(metadata.name).to.equal("Alchemia Lab #1");
    expect(metadata.animation_url).to.include("&sectors=1");
    expect(metadata.attributes.some((a) => a.trait_type === "Built Lab Wings" && a.value === 1)).to.equal(true);
  });

  it("supports capped & infinite supply locking, ERC-2981 royalties, and EIP-4906 live metadata refresh", async function () {
    const { contract, minter, research0, mintPrice } = await deployFixture(0n);
    await contract.connect(minter).mint(2, 1, { value: mintPrice * 2n });
    await contract.setMaxSupply(2);
    await expect(contract.connect(minter).mint(1, 1, { value: mintPrice })).to.be.revertedWithCustomError(
      contract,
      "ExceedsMaxSupply"
    );
    await contract.lockSupplyConfig();
    await expect(contract.setMaxSupply(0)).to.be.revertedWithCustomError(contract, "SupplyAlreadyLocked");

    // EIP-4906 interface support + MetadataUpdate event on upgrade
    expect(await contract.supportsInterface("0x49064906")).to.equal(true);
    await expect(contract.connect(minter).upgradeVessel(1, { value: mintPrice * 5n }))
      .to.emit(contract, "MetadataUpdate")
      .withArgs(1);

    const [receiver, royalty] = await contract.royaltyInfo(1, ethers.parseEther("1"));
    expect(receiver).to.equal(research0.address);
    expect(royalty).to.equal(ethers.parseEther("0.05"));
  });
});
