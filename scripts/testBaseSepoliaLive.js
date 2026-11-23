const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const nftAddr = "0x6f6D4c12EF3b3de964E2C8C84Bed4eBb8a83677F";
  const coinAddr = "0x4Da32048ab4Fc630FED0ECc5a48D6cE3c31Ea382";
  const [deployer] = await hre.ethers.getSigners();

  const nft = await hre.ethers.getContractAt("AlchemiaImpactNFT", nftAddr);
  const coin = await hre.ethers.getContractAt("AlchemiaCoin", coinAddr);

  console.log("Running Live Base Sepolia End-to-End Test as:", deployer.address);

  // 1. Mint Lab #1 ($1 -> 0.0004 ETH)
  const mint1Tx = await nft.mint(1, 0, { value: hre.ethers.parseEther("0.0004") });
  const r1 = await mint1Tx.wait();
  console.log("1) Minted Lab #1 ($1) | tx:", r1.hash);

  // 2. Mint Lab #2 ($25 -> 0.01 ETH, Tier 3)
  const mint2Tx = await nft.mint(1, 1, { value: hre.ethers.parseEther("0.01") });
  const r2 = await mint2Tx.wait();
  console.log("2) Minted Lab #2 ($25 Tier 3) | tx:", r2.hash);

  // 3. Build Cryo-Folding Wing (Sector 0) & Quantum Mining Pavilion (Sector 1) on Lab #2
  const b0Tx = await nft.buildLabSectorWithEth(2, 0, { value: hre.ethers.parseEther("0.002") });
  const rb0 = await b0Tx.wait();
  console.log("3) Built Cryo-Folding Wing on Lab #2 | tx:", rb0.hash);

  const b1Tx = await nft.buildLabSectorWithEth(2, 1, { value: hre.ethers.parseEther("0.004") });
  const rb1 = await b1Tx.wait();
  console.log("4) Built Quantum Mining Pavilion on Lab #2 | tx:", rb1.hash);

  // 4. Anchor a real SHA-256 open-science protein folding proof on Lab #2
  const samplePdb = "HEADER OPEN-SCIENCE FOLD ALCHEMIA #2\nATOM 1 CA ALA A 1 0.000 0.000 0.000 1.00 1.00 C";
  const proofHash = hre.ethers.sha256(hre.ethers.toUtf8Bytes(samplePdb));
  const pTx = await nft.submitResearchProof(2, proofHash, -19420000n, 12, "pdb://alchemia-lab-2");
  const rp = await pTx.wait();
  console.log("5) Anchored SHA-256 Protein Fold Proof on Lab #2 | tx:", rp.hash);

  // 5. Read live on-chain snapshot & metadata verification
  const snap2 = await nft.getLiveImpactSnapshot(2);
  const totalDonated = await nft.totalDonatedWei();
  const lpReserve = await nft.liquidityReserveWei();
  const uri2 = await nft.tokenURI(2);
  const decoded = JSON.parse(
    Buffer.from(uri2.replace("data:application/json;base64,", ""), "base64").toString("utf8")
  );

  console.log("----------------------------------------------------");
  console.log("Live Total Supply:      ", (await nft.totalSupply()).toString());
  console.log("Live Total Research ETH:", hre.ethers.formatEther(totalDonated), "ETH");
  console.log("Live LP Reserve ETH:    ", hre.ethers.formatEther(lpReserve), "ETH");
  console.log("Lab #2 Tier:            ", snap2.complexityTier.toString(), "/ 5");
  console.log("Lab #2 Built Wings Mask:", snap2.sectorsMask.toString(), "(binary:", Number(snap2.sectorsMask).toString(2), ")");
  console.log("Lab #2 Mining Rate:     ", hre.ethers.formatEther(snap2.miningRatePerHour), "$ALCH/hr");
  console.log("Lab #2 Verified WUs:    ", snap2.workUnits.toString());
  console.log("Lab #2 animation_url:   ", decoded.animation_url);
  console.log("$ALCH Controller Lock:  ", await coin.nftController());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
