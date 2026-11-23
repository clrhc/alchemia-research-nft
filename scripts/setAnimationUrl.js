const hre = require("hardhat");

async function main() {
  const nft = await hre.ethers.getContractAt(
    "AlchemiaImpactNFT",
    "0x6f6D4c12EF3b3de964E2C8C84Bed4eBb8a83677F"
  );
  const newUrl = "https://alchemia-labs.s2celerity.workers.dev/animation.html";
  const tx = await nft.setAnimationBaseUrl(newUrl);
  const receipt = await tx.wait();
  console.log("Updated on-chain animationBaseUrl ->", newUrl);
  console.log("Tx:", receipt.hash);
  console.log("Lab #2 live animation_url:", await nft.animationUrlOf(2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
