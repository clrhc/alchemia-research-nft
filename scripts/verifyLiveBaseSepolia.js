const { ethers } = require("ethers");
require("dotenv").config();

const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const NFT_ADDR = "0x6f6D4c12EF3b3de964E2C8C84Bed4eBb8a83677F";
const COIN_ADDR = "0x4Da32048ab4Fc630FED0ECc5a48D6cE3c31Ea382";
const RENDERER_ADDR = "0x5Bfc9ABf9f2aA81C38a11235A85E70501Fc6EAFb";

const NFT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function mintActive() view returns (bool)",
  "function totalDonatedWei() view returns (uint256)",
  "function liquidityReserveWei() view returns (uint256)",
  "function liquidityThresholdWei() view returns (uint256)",
  "function liquiditySeeded() view returns (bool)",
  "function animationBaseUrl() view returns (string)",
  "function animationUrlOf(uint256) view returns (string)",
  "function tokenURI(uint256) view returns (string)",
  "function getLiveImpactSnapshot(uint256) view returns (tuple(bytes32 seed,uint8 causeId,uint64 mintedAt,uint256 tokenTotalValueWei,uint256 tokenImpactWei,uint256 causeTotalWei,uint256 globalTotalDonatedWei,uint256 currentSupply,uint256 currentMaxSupply,bool isSupplyLocked,uint8 reactionStage,uint8 complexityTier,uint8 sectorsMask,uint256 pendingCoins,uint256 miningRatePerHour,uint32 workUnits,string causeName,address researchWallet))"
];

const COIN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function nftController() view returns (address)",
  "function totalDonatedToResearch() view returns (uint256)"
];

async function main() {
  const network = ethers.Network.from(84532);
  const provider = new ethers.JsonRpcProvider(RPC, network, {
    staticNetwork: network,
    batchMaxCount: 1
  });
  console.log(`\n=== LIVE BASE SEPOLIA VERIFICATION (chainId: ${network.chainId}) ===`);

  for (const [label, addr] of [
    ["AlchemiaImpactNFT", NFT_ADDR],
    ["AlchemiaCoin ($ALCH)", COIN_ADDR],
    ["AlchemiaRenderer", RENDERER_ADDR]
  ]) {
    const code = await provider.getCode(addr);
    const bytes = code === "0x" ? 0 : (code.length - 2) / 2;
    console.log(`  [${bytes > 0 ? "LIVE" : "MISSING"}] ${label.padEnd(22)} ${addr} (${bytes} B)`);
  }

  const nft = new ethers.Contract(NFT_ADDR, NFT_ABI, provider);
  const coin = new ethers.Contract(COIN_ADDR, COIN_ABI, provider);

  const [name, symbol, supply, maxSup, active, donated, lpRes, lpThresh, lpSeeded, animBase] =
    await Promise.all([
      nft.name(),
      nft.symbol(),
      nft.totalSupply(),
      nft.maxSupply(),
      nft.mintActive(),
      nft.totalDonatedWei(),
      nft.liquidityReserveWei(),
      nft.liquidityThresholdWei(),
      nft.liquiditySeeded(),
      nft.animationBaseUrl()
    ]);

  const [cName, cSym, cSup, cMax, controller, cDonated] = await Promise.all([
    coin.name(),
    coin.symbol(),
    coin.totalSupply(),
    coin.MAX_SUPPLY(),
    coin.nftController(),
    coin.totalDonatedToResearch()
  ]);

  console.log(`\nNFT: ${name} (${symbol}) | Supply: ${supply}/${maxSup === 0n ? "open" : maxSup} | Mint active: ${active}`);
  console.log(`Research routed: ${ethers.formatEther(donated)} ETH | LP Reserve: ${ethers.formatEther(lpRes)} / ${ethers.formatEther(lpThresh)} ETH (seeded: ${lpSeeded})`);
  console.log(`Animation Base URL: ${animBase}`);
  console.log(
    `Coin: ${cName} (${cSym}) | Supply: ${ethers.formatEther(cSup)} / ${ethers.formatEther(cMax)} | Controller locked: ${controller.toLowerCase() === NFT_ADDR.toLowerCase()} | Coin donated: ${ethers.formatEther(cDonated)}`
  );

  const count = Number(supply);
  for (let id = 1; id <= Math.min(count, 5); id++) {
    const snap = await nft.getLiveImpactSnapshot(id);
    const uri = await nft.tokenURI(id);
    const parsed = JSON.parse(
      Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8")
    );
    const svg = Buffer.from(
      parsed.image.replace("data:image/svg+xml;base64,", ""),
      "base64"
    ).toString("utf8");
    console.log(
      `  Lab #${id}: Tier ${snap.complexityTier} | SectorsMask ${snap.sectorsMask} | Rate ${ethers.formatEther(snap.miningRatePerHour)} ALCH/hr | Pending ${Number(ethers.formatEther(snap.pendingCoins)).toFixed(2)} ALCH | SVG valid: ${svg.includes("<svg")} | animUrl OK: ${parsed.animation_url.startsWith("https://")}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
