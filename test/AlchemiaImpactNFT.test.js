const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Alchemia Ecosystem ($ALCH Coin + Liquidity Threshold + Sims-Style Lab Sectors + Research Proofs)", function () {
  async function deployFixture(initialMaxSupply = 0n) {
    const [owner, minter, other, devWallet, lpVault, research0, research1, research2, research3] =
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
      "https://alchemia-labs.s2celerity.workers.dev/animation.html",
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
      other,
      devWallet,
      lpVault,
      research0,
      research1,
      research2,
      research3,
      mintPrice
    };
  }

  it("stays comfortably under Ethereum Mainnet EIP-170 24,576-byte deployed bytecode limit", async function () {
    const { coin, renderer, contract } = await deployFixture(0n);
    for (const [label, c] of [
      ["AlchemiaCoin", coin],
      ["AlchemiaRenderer", renderer],
      ["AlchemiaImpactNFT", contract]
    ]) {
      const code = await ethers.provider.getCode(await c.getAddress());
      const bytes = (code.length - 2) / 2;
      expect(bytes, `${label} bytecode size`).to.be.lessThan(24576);
    }
  });

  it("Phase 1 splits 60% research / 25% dev / 15% liquidity reserve, seeds LP at threshold, then switches to 66.67% / 33.33%", async function () {
    const { coin, contract, minter, devWallet, lpVault, research0, mintPrice } = await deployFixture(0n);

    await expect(
      contract.setLiquidityConfig(ethers.parseEther("0.15"), ethers.parseEther("10000000"), lpVault.address)
    ).to.emit(contract, "LiquidityConfigUpdated");

    // Cannot seed before threshold is met
    await expect(contract.seedLiquidity()).to.be.revertedWithCustomError(
      contract,
      "LiquidityThresholdNotMet"
    );

    const rBefore = await ethers.provider.getBalance(research0.address);
    const dBefore = await ethers.provider.getBalance(devWallet.address);

    // Mint 1 NFT with 1.0 ETH -> 0.60 ETH immediate research, 0.25 ETH immediate dev, 0.15 ETH LP reserve
    const amount1 = ethers.parseEther("1");
    await contract.connect(minter).mint(1, 0, { value: amount1 });

    expect(await ethers.provider.getBalance(research0.address)).to.equal(rBefore + ethers.parseEther("0.6"));
    expect(await ethers.provider.getBalance(devWallet.address)).to.equal(dBefore + ethers.parseEther("0.25"));
    expect(await contract.liquidityReserveWei()).to.equal(ethers.parseEther("0.15"));

    // Permissionless seedLiquidity() works from any caller once threshold is met
    const lpEthBefore = await ethers.provider.getBalance(lpVault.address);
    await expect(contract.connect(minter).seedLiquidity()).to.emit(contract, "LiquiditySeeded");
    expect(await contract.liquiditySeeded()).to.equal(true);
    expect(await ethers.provider.getBalance(lpVault.address)).to.equal(lpEthBefore + ethers.parseEther("0.15"));
    expect(await coin.balanceOf(lpVault.address)).to.equal(ethers.parseEther("10000000"));

    // Cannot seed twice or modify LP config after seeding
    await expect(contract.seedLiquidity()).to.be.revertedWithCustomError(
      contract,
      "LiquidityAlreadySeeded"
    );
    await expect(
      contract.setLiquidityConfig(ethers.parseEther("2"), ethers.parseEther("1000"), lpVault.address)
    ).to.be.revertedWithCustomError(contract, "LiquidityAlreadySeeded");

    // Phase 2 (Post-Liquidity): immediately splits 66.67% Research / 33.33% Dev with 0 ETH held in contract
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

  it("enforces zero-tax standard ERC-20 transfers, immutable controller, renounced ownership safety & zero-amount guards on $ALCH", async function () {
    const { coin, contract, owner, minter, other, research0, mintPrice } = await deployFixture(0n);

    // Mint + accrue 100 hours on Tier 1 (5 ALCH/hr -> 500 ALCH)
    await contract.connect(minter).mint(1, 0, { value: mintPrice });
    await time.increase(100 * 3600);
    await contract.connect(minter).claimMinedCoins(1, 0);

    const startBal = await coin.balanceOf(minter.address);
    expect(startBal).to.be.gte(ethers.parseEther("500"));

    // Standard transfer incurs EXACTLY 0% tax (100% received by recipient!)
    const transferAmt = ethers.parseEther("123.456789");
    await coin.connect(minter).transfer(other.address, transferAmt);
    expect(await coin.balanceOf(other.address)).to.equal(transferAmt);
    expect(await coin.balanceOf(minter.address)).to.equal(startBal - transferAmt);

    // Non-controller cannot mint
    await expect(
      coin.connect(owner).mintFromController(owner.address, ethers.parseEther("1"))
    ).to.be.revertedWithCustomError(coin, "NotController");

    // Controller cannot be swapped after one-time initialization
    await expect(coin.initializeController(other.address)).to.be.revertedWithCustomError(
      coin,
      "ControllerAlreadyInitialized"
    );

    // Direct donation guards against zero address & zero amount
    await expect(
      coin.connect(minter).donateToResearch(ethers.ZeroAddress, ethers.parseEther("5"))
    ).to.be.revertedWithCustomError(coin, "ZeroAddress");
    await expect(
      coin.connect(minter).donateToResearch(research0.address, 0)
    ).to.be.revertedWithCustomError(coin, "ZeroAmount");

    // Renouncing ownership leaves zero admin keys while mining controller keeps working!
    await coin.renounceOwnership();
    expect(await coin.owner()).to.equal(ethers.ZeroAddress);
    await time.increase(3600);
    await expect(contract.connect(minter).claimMinedCoins(1, 1000)).to.emit(contract, "CoinsClaimed");
  });

  it("supports EIP-2612 gasless permit signatures on AlchemiaCoin ($ALCH)", async function () {
    const { coin, contract, minter, other, mintPrice } = await deployFixture(0n);
    await contract.connect(minter).mint(1, 0, { value: mintPrice });
    await time.increase(10 * 3600);
    await contract.connect(minter).claimMinedCoins(1, 0);

    const value = ethers.parseEther("25");
    const nonce = await coin.nonces(minter.address);
    const deadline = BigInt(await time.latest()) + 3600n;
    const network = await ethers.provider.getNetwork();

    const domain = {
      name: "Alchemia Coin",
      version: "1",
      chainId: network.chainId,
      verifyingContract: await coin.getAddress()
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const sig = await minter.signTypedData(domain, types, {
      owner: minter.address,
      spender: other.address,
      value,
      nonce,
      deadline
    });
    const { v, r, s } = ethers.Signature.from(sig);
    await coin.permit(minter.address, other.address, value, deadline, v, r, s);
    expect(await coin.allowance(minter.address, other.address)).to.equal(value);
  });

  it("runs $ALCH mining game, enforces owner-only actions, burns 80% & routes 20% to research on room build", async function () {
    const { coin, contract, minter, other, research0, mintPrice } = await deployFixture(0n);

    // Mint a Tier 3 ($25) lab -> base mining rate = 15 ALCH/hour
    await contract.connect(minter).mint(1, 0, { value: mintPrice * 25n });
    expect(await contract.miningRatePerHourOf(1)).to.equal(ethers.parseEther("15"));

    // Advance 20 hours -> 300 ALCH accrued
    await time.increase(20 * 3600);

    // Non-owner cannot claim or build rooms
    await expect(contract.connect(other).claimMinedCoins(1, 1000)).to.be.revertedWithCustomError(
      contract,
      "NotTokenOwner"
    );
    await expect(contract.connect(minter).claimMinedCoins(1, 10001)).to.be.revertedWithCustomError(
      contract,
      "InvalidTithe"
    );

    // Claim with a 20% automatic tithe to the research wallet
    await expect(contract.connect(minter).claimMinedCoins(1, 2000)).to.emit(contract, "CoinsClaimed");
    const researchBefore = await coin.balanceOf(research0.address);
    const totalSupplyBefore = await coin.totalSupply();

    // Build Sector #1 (Mining Room, cost 220 ALCH): 80% (176) burned, 20% (44) sent to research
    await coin.connect(minter).approve(await contract.getAddress(), ethers.parseEther("220"));
    await expect(contract.connect(minter).buildLabSectorWithCoins(1, 1))
      .to.emit(contract, "LabSectorBuilt")
      .withArgs(1, 1, 2, true)
      .and.to.emit(contract, "MetadataUpdate")
      .withArgs(1);

    expect(await coin.balanceOf(research0.address)).to.equal(researchBefore + ethers.parseEther("44"));
    expect(await coin.totalSupply()).to.equal(totalSupplyBefore - ethers.parseEther("176"));

    // Duplicate build or out-of-range sector reverts cleanly
    await expect(contract.connect(minter).buildLabSectorWithCoins(1, 1)).to.be.revertedWithCustomError(
      contract,
      "SectorAlreadyBuilt"
    );
    await expect(contract.connect(minter).buildLabSectorWithCoins(1, 6)).to.be.revertedWithCustomError(
      contract,
      "InvalidSector"
    );

    // Mining rate jumps immediately from 15 ALCH/hr to 29 ALCH/hr (+14 ALCH/hr bonus)
    expect(await contract.miningRatePerHourOf(1)).to.equal(ethers.parseEther("29"));

    // Direct $ALCH coin donation to researcher wallet
    await coin.connect(minter).donateToResearch(research0.address, ethers.parseEther("10"));
    expect(await coin.totalDonatedToResearch()).to.equal(ethers.parseEther("10"));
  });

  it("anchors verifiable SHA-256 open-science protein folding proofs and caps work-unit mining bonus at +40 ALCH/hr", async function () {
    const { contract, minter, other, mintPrice } = await deployFixture(0n);

    await contract.connect(minter).mint(1, 0, { value: mintPrice });
    const rateBefore = await contract.miningRatePerHourOf(1);

    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("ATOM      1  CA  ASN A   1"));
    await expect(
      contract.connect(other).submitResearchProof(1, proofHash, -18450000n, 10, "pdb://lab-1")
    ).to.be.revertedWithCustomError(contract, "NotTokenOwner");

    await expect(
      contract.connect(minter).submitResearchProof(1, proofHash, -18450000n, 10, "pdb://lab-1")
    )
      .to.emit(contract, "ResearchDiscoveryAnchored")
      .and.to.emit(contract, "MetadataUpdate")
      .withArgs(1);

    // 10 verified WUs adds +5 ALCH/hr mining boost
    expect(await contract.miningRatePerHourOf(1)).to.equal(rateBefore + ethers.parseEther("5"));

    // Submitting 200 more WUs respects the +40 ALCH/hr cap cleanly
    await contract.connect(minter).submitResearchProof(1, proofHash, -24000000n, 200, "pdb://lab-1-v2");
    expect(await contract.miningRatePerHourOf(1)).to.equal(rateBefore + ethers.parseEther("40"));
    expect(await contract.totalResearchWorkUnits()).to.equal(210n);
  });

  it("renders upgraded Swiss architectural blueprint SVG & JSON tokenURI reflecting rooms, tier & duo pet", async function () {
    const { contract, minter, mintPrice } = await deployFixture(0n);

    await contract.connect(minter).mint(1, 0, { value: mintPrice * 5n });
    await contract.connect(minter).buildLabSectorWithEth(1, 0, { value: mintPrice * 5n });
    await contract.connect(minter).buildLabSectorWithEth(1, 3, { value: mintPrice * 5n });

    const uri = await contract.tokenURI(1);
    const metadata = JSON.parse(
      Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8")
    );

    expect(metadata.name).to.equal("Alchemia Lab #1");
    expect(metadata.animation_url).to.include("&sectors=9");
    expect(metadata.attributes.some((a) => a.trait_type === "Built Lab Wings" && a.value === 2)).to.equal(true);

    const svg = Buffer.from(
      metadata.image.replace("data:image/svg+xml;base64,", ""),
      "base64"
    ).toString("utf8");
    expect(svg).to.include("<svg");
    expect(svg).to.include("CRYO");
    expect(svg).to.include("PETS");
    expect(svg).to.include("2/6 Rooms");
  });

  it("supports capped/infinite supply lock, metadata freeze, pause toggle, ERC-2981 royalties & EIP-4906", async function () {
    const { contract, minter, research0, mintPrice } = await deployFixture(0n);
    await contract.connect(minter).mint(2, 1, { value: mintPrice * 2n });

    // Cannot set cap below minted supply
    await expect(contract.setMaxSupply(1)).to.be.revertedWithCustomError(
      contract,
      "CapBelowCurrentSupply"
    );

    await contract.setMaxSupply(2);
    await expect(contract.connect(minter).mint(1, 1, { value: mintPrice })).to.be.revertedWithCustomError(
      contract,
      "ExceedsMaxSupply"
    );
    await contract.lockSupplyConfig();
    await expect(contract.setMaxSupply(0)).to.be.revertedWithCustomError(contract, "SupplyAlreadyLocked");

    // Pause / unpause mint emits MintConfigUpdated
    await expect(contract.setMintConfig(mintPrice, false)).to.emit(contract, "MintConfigUpdated");
    await expect(contract.connect(minter).mint(1, 0, { value: mintPrice })).to.be.revertedWithCustomError(
      contract,
      "MintPaused"
    );

    // BatchMetadataUpdate on URL update, then permanent MetadataFrozen lock
    await expect(contract.setAnimationBaseUrl("ipfs://bafyalchemia/animation.html"))
      .to.emit(contract, "BatchMetadataUpdate")
      .withArgs(1, ethers.MaxUint256);
    await expect(contract.freezeAnimationBaseUrl()).to.emit(contract, "MetadataFrozen");
    await expect(contract.setAnimationBaseUrl("https://evil.example")).to.be.revertedWithCustomError(
      contract,
      "MetadataAlreadyFrozen"
    );

    // EIP-4906 interface support + MetadataUpdate event on single-NFT upgrade
    expect(await contract.supportsInterface("0x49064906")).to.equal(true);
    await expect(contract.connect(minter).upgradeVessel(1, { value: mintPrice * 5n }))
      .to.emit(contract, "MetadataUpdate")
      .withArgs(1);

    const [receiver, royalty] = await contract.royaltyInfo(1, ethers.parseEther("1"));
    expect(receiver).to.equal(research0.address);
    expect(royalty).to.equal(ethers.parseEther("0.05"));
  });

  it("handles multi-mint remainder wei cleanly, transfer mining continuity, boostTokenImpact & negative energy ranking", async function () {
    const { coin, contract, minter, other, devWallet, research1, mintPrice } = await deployFixture(0n);

    // Multi-mint 3 labs with odd wei amount (3 * mintPrice + 2 wei) -> zero wei lost to rounding
    const oddValue = mintPrice * 3n + 2n;
    const rBefore = await ethers.provider.getBalance(research1.address);
    const dBefore = await ethers.provider.getBalance(devWallet.address);
    await contract.connect(minter).mint(3, 1, { value: oddValue });

    const rGain = (await ethers.provider.getBalance(research1.address)) - rBefore;
    const dGain = (await ethers.provider.getBalance(devWallet.address)) - dBefore;
    const lpGain = await contract.liquidityReserveWei();
    expect(rGain + dGain + lpGain).to.equal(oddValue);
    expect(await contract.totalSupply()).to.equal(3n);

    // Transfer Lab #2 to `other` after 5 hours -> new owner inherits pending coins cleanly and seller cannot claim
    await time.increase(5 * 3600);
    await contract.connect(minter).safeTransferFrom(minter.address, other.address, 2);
    await expect(contract.connect(minter).claimMinedCoins(2, 0)).to.be.revertedWithCustomError(
      contract,
      "NotTokenOwner"
    );
    await contract.connect(other).claimMinedCoins(2, 1000);
    expect(await coin.balanceOf(other.address)).to.be.gte(ethers.parseEther("22"));

    // boostTokenImpact upgrades tier smoothly and emits MetadataUpdate
    await expect(contract.connect(other).boostTokenImpact(2, { value: mintPrice * 25n }))
      .to.emit(contract, "VesselUpgraded")
      .and.to.emit(contract, "MetadataUpdate")
      .withArgs(2);
    expect(await contract.complexityTierOf(2)).to.equal(3);

    // Signed negative energy micro-values only overwrite bestEnergyMicro when strictly lower (better fold!)
    const h1 = ethers.keccak256(ethers.toUtf8Bytes("fold-1"));
    const h2 = ethers.keccak256(ethers.toUtf8Bytes("fold-2-worse"));
    const h3 = ethers.keccak256(ethers.toUtf8Bytes("fold-3-better"));
    await contract.connect(other).submitResearchProof(2, h1, -22500000n, 4, "pdb://1");
    await contract.connect(other).submitResearchProof(2, h2, -14000000n, 3, "pdb://2");
    let rp = await contract.researchProofs(2);
    expect(rp.proofHash).to.equal(h1); // Kept lower-energy fold!
    expect(rp.bestEnergyMicro).to.equal(-22500000n);
    expect(rp.workUnits).to.equal(7);

    await contract.connect(other).submitResearchProof(2, h3, -41200000n, 5, "pdb://3");
    rp = await contract.researchProofs(2);
    expect(rp.proofHash).to.equal(h3); // Updated to strictly better fold!
    expect(rp.bestEnergyMicro).to.equal(-41200000n);
    expect(rp.workUnits).to.equal(12);
  });

  it("exposes valid ERC-7572 on-chain contractURI JSON + SVG and emits ContractURIUpdated", async function () {
    const { contract } = await deployFixture(0n);

    const uri = await contract.contractURI();
    expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
    const meta = JSON.parse(
      Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8")
    );
    expect(meta.name).to.equal("Alchemia Labs");
    expect(meta.description).to.include("0% tax ALCH");
    expect(meta.external_link).to.include("animation.html");

    const logoSvg = Buffer.from(
      meta.image.replace("data:image/svg+xml;base64,", ""),
      "base64"
    ).toString("utf8");
    expect(logoSvg).to.include("<svg");

    await expect(contract.setAnimationBaseUrl("https://alchemia.example/animation.html")).to.emit(
      contract,
      "ContractURIUpdated"
    );
  });

  it("enforces exact mint boundary guards (0, >20, invalid cause, underpayment) and allows exact 20-lab batch mint", async function () {
    const { contract, minter, mintPrice } = await deployFixture(0n);

    await expect(contract.connect(minter).mint(0, 0, { value: mintPrice })).to.be.revertedWithCustomError(
      contract,
      "InvalidQuantity"
    );
    await expect(
      contract.connect(minter).mint(21, 0, { value: mintPrice * 21n })
    ).to.be.revertedWithCustomError(contract, "InvalidQuantity");
    await expect(contract.connect(minter).mint(1, 9, { value: mintPrice })).to.be.revertedWithCustomError(
      contract,
      "InvalidCause"
    );
    await expect(
      contract.connect(minter).mint(2, 0, { value: mintPrice * 2n - 1n })
    ).to.be.revertedWithCustomError(contract, "InsufficientPayment");

    // Exact MAX_MINT_PER_TX = 20 succeeds cleanly
    await contract.connect(minter).mint(20, 2, { value: mintPrice * 20n });
    expect(await contract.totalSupply()).to.equal(20n);
  });

  it("validates ETH room build guards and full 6-room campus mining rate (sectorsMask == 63)", async function () {
    const { contract, minter, other, mintPrice } = await deployFixture(0n);

    await contract.connect(minter).mint(1, 0, { value: mintPrice }); // Tier 1 = 5 ALCH/hr base

    // Non-owner, invalid sector, and underpayment revert cleanly
    await expect(
      contract.connect(other).buildLabSectorWithEth(1, 0, { value: mintPrice * 5n })
    ).to.be.revertedWithCustomError(contract, "NotTokenOwner");
    await expect(
      contract.connect(minter).buildLabSectorWithEth(1, 6, { value: mintPrice * 5n })
    ).to.be.revertedWithCustomError(contract, "InvalidSector");
    await expect(
      contract.connect(minter).buildLabSectorWithEth(1, 0, { value: mintPrice * 4n })
    ).to.be.revertedWithCustomError(contract, "InsufficientPayment");

    // Build all 6 wings via ETH -> sectorsMask == 63 (0b111111)
    for (let s = 0; s < 6; s++) {
      await contract.connect(minter).buildLabSectorWithEth(1, s, { value: mintPrice * 5n });
    }
    const snap = await contract.getLiveImpactSnapshot(1);
    expect(snap.sectorsMask).to.equal(63n);
    // Base (Tier 3 from 1 + 30 = $31 -> Tier 3 = 15 ALCH/hr) + (4+14+8+6+18+28 = 78 ALCH/hr) = 93 ALCH/hr
    expect(snap.miningRatePerHour).to.equal(ethers.parseEther("93"));

    // Duplicate room build reverts
    await expect(
      contract.connect(minter).buildLabSectorWithEth(1, 5, { value: mintPrice * 5n })
    ).to.be.revertedWithCustomError(contract, "SectorAlreadyBuilt");
  });

  it("supports standard ERC20Burnable burn() & burnFrom() without hidden transfer fees", async function () {
    const { coin, contract, minter, other, mintPrice } = await deployFixture(0n);

    await contract.connect(minter).mint(1, 0, { value: mintPrice });
    await time.increase(20 * 3600);
    await contract.connect(minter).claimMinedCoins(1, 0);

    const supplyBefore = await coin.totalSupply();
    await coin.connect(minter).burn(ethers.parseEther("10"));
    expect(await coin.totalSupply()).to.equal(supplyBefore - ethers.parseEther("10"));

    await coin.connect(minter).approve(other.address, ethers.parseEther("15"));
    await coin.connect(other).burnFrom(minter.address, ethers.parseEther("15"));
    expect(await coin.totalSupply()).to.equal(supplyBefore - ethers.parseEther("25"));
  });
});
