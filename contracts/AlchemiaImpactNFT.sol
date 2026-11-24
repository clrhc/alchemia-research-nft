// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AlchemiaCoin.sol";
import "./AlchemiaRenderer.sol";

/**
 * @title AlchemiaImpactNFT
 * @notice Ethereum Mainnet living 3D architectural alchemical laboratory NFTs:
 *
 *  - Capped OR Infinite Supply (setMaxSupply / lockSupplyConfig)
 *  - Single-NFT Scaling ($1 upward via mint() or upgradeVessel())
 *  - Sims-Style Modular 3D Lab Sector Expansion (6 buildable wings paid via mined $ALCH or ETH!)
 *  - Built-In $ALCH Coin Mining Game (mining rate boosted by installed wings + research proofs,
 *    with optional direct research tithe when claiming & direct $ALCH researcher donations!)
 *  - Transparent Two-Phase Split with Automatic Liquidity Threshold:
 *      Phase 1 (Bootstrapping $ALCH Liquidity until `liquidityThresholdWei` reached):
 *        * 60% (6000 bps) IMMEDIATELY to Research Wallet
 *        * 25% (2500 bps) IMMEDIATELY to Dev Wallet
 *        * 15% (1500 bps) to On-Chain $ALCH Liquidity Reserve
 *        Once threshold is met, `seedLiquidity()` pairs reserve ETH + initial $ALCH directly
 *        to the Liquidity Pool Vault and transitions permanently to Phase 2!
 *      Phase 2 (Post-Liquidity Seeding):
 *        * 66.67% (6667 bps) IMMEDIATELY to Research Wallet
 *        * 33.33% (3333 bps) IMMEDIATELY to Dev Wallet (0 ETH held in contract)
 */
contract AlchemiaImpactNFT is ERC721Enumerable, ERC2981, Ownable2Step, ReentrancyGuard {

    // Phase 1 (Pre-Liquidity Seed): 60% Research / 25% Dev / 15% Liquidity Reserve
    uint96 public constant BOOTSTRAP_RESEARCH_BPS = 6000;
    uint96 public constant BOOTSTRAP_DEV_BPS = 2500;
    uint96 public constant BOOTSTRAP_LP_BPS = 1500;

    // Phase 2 (Post-Liquidity Seed): 66.67% Research / 33.33% Dev
    uint96 public constant POST_LP_RESEARCH_BPS = 6667;
    uint96 public constant POST_LP_DEV_BPS = 3333;
    uint96 public constant MAX_BPS = 10000;

    uint256 public constant MAX_MINT_PER_TX = 20;
    uint8 public constant SECTOR_COUNT = 6;

    // Sector bit indices (Sims-style modular 3D architectural wings):
    // 0: Cryo-Folding Wing       (+research folding)
    // 1: Quantum Mining Pavilion (+high $ALCH coin mining)
    // 2: Solar Catalysis Dome    (+clean-energy passive yield & folding)
    // 3: Companion Sanctuary     (+paired Cat & Dog familiar resonance)
    // 4: Proton Accelerator Spire(+particle proofs & mining multiplier)
    // 5: Philosopher Observatory (+4D hypercube & peak coin/research output)
    uint256[6] public sectorCoinCosts = [
        150 ether,
        220 ether,
        300 ether,
        420 ether,
        650 ether,
        1000 ether
    ];

    uint256[6] public sectorMiningBonusPerHour = [
        4 ether,   // Cryo-Folding
        14 ether,  // Quantum Mining Pavilion (big mining boost!)
        8 ether,   // Solar Catalysis Dome
        6 ether,   // Companion Sanctuary
        18 ether,  // Proton Accelerator Spire
        28 ether   // Philosopher Observatory
    ];

    struct Cause {
        string name;
        string category;
        address payable researchWallet;
        uint256 totalRaisedWei;
        uint256 mintCount;
        bool active;
    }

    struct TokenRecord {
        bytes32 seed;
        uint8 causeId;
        uint64 mintedAt;
        uint128 totalValueWei;
        uint128 researchWei;
        uint8 sectorsMask;
        uint64 lastClaimAt;
    }

    struct ResearchProof {
        bytes32 proofHash;
        int64 bestEnergyMicro;
        uint32 workUnits;
        uint64 updatedAt;
    }

    /// @notice Packed on-chain multi-story Architect Estate & Sims customization state (1 storage slot!)
    struct EstateBlueprint {
        uint8 houseSize;        // 1 = Cozy Studio, 2 = Atrium Villa, 3 = Grand Estate
        uint8 houseFloors;      // 1..3 (1F, 2F Mezzanine Loft, 3F Starlight Sky Penthouse)
        uint8 extraRoomsMask;   // 6-bit mask: Bedroom(0), Kitchen(1), Library(2), Conservatory(3), Studio(4), Music(5)
        bool hasBasement;       // true = B1 Sunken Architect Basement unlocked
        uint32 gardenHarvests;  // Recorded botanical greenhouse & courtyard harvests
        uint64 stylePacked;     // Bit-packed floor/wall/patio/seating/bar/hobby/rug/plants/lighting styles
        uint64 updatedAt;
    }

    struct LiveImpactSnapshot {
        bytes32 seed;
        uint8 causeId;
        uint64 mintedAt;
        uint256 tokenTotalValueWei;
        uint256 tokenImpactWei;
        uint256 causeTotalWei;
        uint256 globalTotalDonatedWei;
        uint256 currentSupply;
        uint256 currentMaxSupply;
        bool isSupplyLocked;
        uint8 reactionStage;
        uint8 complexityTier;
        uint8 sectorsMask;
        uint256 pendingCoins;
        uint256 miningRatePerHour;
        uint32 workUnits;
        string causeName;
        address researchWallet;
    }

    AlchemiaCoin public immutable coin;
    AlchemiaRenderer public immutable renderer;

    uint256 public maxSupply;
    bool public supplyConfigLocked;
    uint256 public mintPriceWei;
    address payable public devWallet;
    address payable public liquidityVault;
    string public animationBaseUrl;
    bool public metadataFrozen;
    bool public mintActive = true;

    // Automatic Liquidity Seeding Threshold
    uint256 public liquidityThresholdWei = 1 ether;
    uint256 public liquidityReserveWei;
    uint256 public liquiditySeedCoins = 10_000_000 ether; // Paired $ALCH minted to LP on seed
    bool public liquiditySeeded;

    // Global Telemetry
    uint256 public totalDonatedWei;
    uint256 public totalDevWei;
    uint256 public totalResearchWorkUnits;
    uint256 public totalDiscoveriesAnchored;
    uint256 public totalCoinsTithedToResearch;

    uint256[4] public stageThresholdsWei = [0.05 ether, 0.25 ether, 1 ether, 5 ether];

    Cause[] public causes;
    mapping(uint256 => TokenRecord) public tokenRecords;
    mapping(uint256 => ResearchProof) public researchProofs;
    mapping(uint256 => EstateBlueprint) public estateBlueprints;
    mapping(uint256 => string) public estateProfileCodes;
    uint256 private _nextTokenId = 1;

    // On-chain $ALCH cost constants for multi-story home & homely room expansions (80% burned, 20% research)
    uint256 public constant ESTATE_SIZE_COIN_COST = 80 ether;
    uint256 public constant ESTATE_FLOOR_COIN_COST = 90 ether;
    uint256 public constant ESTATE_ROOM_COIN_COST = 45 ether;
    uint256 public constant MAX_PROFILE_CODE_BYTES = 256;

    // EIP-4906 ERC-721 Metadata Update Extension (auto-refreshes OpenSea / wallets on upgrade!)
    bytes4 private constant _INTERFACE_ID_ERC4906 = 0x49064906;

    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
    // ERC-7572 Contract-Level Metadata event
    event ContractURIUpdated();

    event VesselMinted(
        address indexed minter,
        uint256 indexed tokenId,
        uint8 indexed causeId,
        bytes32 seed,
        uint256 totalValueWei,
        uint256 researchWei,
        uint256 devWei,
        uint256 lpWei,
        uint8 complexityTier,
        uint256 globalDonatedWei
    );
    event VesselUpgraded(
        address indexed supporter,
        uint256 indexed tokenId,
        uint256 addedValueWei,
        uint256 newTotalValueWei,
        uint8 newComplexityTier,
        uint256 globalDonatedWei
    );
    event LabSectorBuilt(
        uint256 indexed tokenId,
        uint8 indexed sectorId,
        uint8 newSectorsMask,
        bool paidWithCoins
    );
    event EstateExpanded(
        uint256 indexed tokenId,
        uint8 houseSize,
        uint8 houseFloors,
        bool hasBasement,
        uint8 extraRoomsMask,
        bool paidWithCoins
    );
    event EstateCustomized(
        uint256 indexed tokenId,
        uint64 stylePacked,
        uint32 gardenHarvests
    );
    event CoinsClaimed(
        uint256 indexed tokenId,
        address indexed holder,
        uint256 holderAmount,
        uint256 researchTitheAmount
    );
    event LiquiditySeeded(
        address indexed liquidityVault,
        uint256 ethAmount,
        uint256 coinAmount
    );
    event ResearchWalletFunded(uint8 indexed causeId, address indexed researchWallet, uint256 amountWei);
    event DevWalletFunded(address indexed devWallet, uint256 amountWei);
    event ResearchDiscoveryAnchored(
        uint256 indexed tokenId,
        address indexed contributor,
        bytes32 indexed proofHash,
        int64 bestEnergyMicro,
        uint32 addedWorkUnits,
        string datasetUri
    );
    event SupplyCapUpdated(uint256 previousMaxSupply, uint256 newMaxSupply);
    event SupplyConfigLocked(uint256 finalMaxSupply);
    event MintConfigUpdated(uint256 newMintPriceWei, bool active);
    event LiquidityConfigUpdated(uint256 thresholdWei, uint256 seedCoinsAmount, address indexed vault);
    event MetadataFrozen(string finalAnimationBaseUrl);

    error MintPaused();
    error InvalidQuantity();
    error ExceedsMaxSupply();
    error InsufficientPayment();
    error InvalidCause();
    error CauseInactive();
    error SupplyAlreadyLocked();
    error MetadataAlreadyFrozen();
    error CapBelowCurrentSupply();
    error ZeroAddress();
    error TokenDoesNotExist();
    error NotTokenOwner();
    error InvalidSector();
    error SectorAlreadyBuilt();
    error InvalidTithe();
    error NothingToClaim();
    error LiquidityThresholdNotMet();
    error LiquidityAlreadySeeded();
    error InvalidEstateConfig();
    error ProfileCodeTooLong();
    error TransferFailed();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialMaxSupply_,
        uint256 initialMintPriceWei_,
        uint96 royaltyBps_,
        address payable devWallet_,
        address payable liquidityVault_,
        address coinAddress_,
        address rendererAddress_,
        string memory animationBaseUrl_,
        string[] memory causeNames_,
        string[] memory causeCategories_,
        address payable[] memory researchWallets_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        if (
            devWallet_ == address(0) ||
            liquidityVault_ == address(0) ||
            coinAddress_ == address(0) ||
            rendererAddress_ == address(0)
        ) revert ZeroAddress();
        require(
            causeNames_.length > 0 &&
                causeNames_.length == causeCategories_.length &&
                causeNames_.length == researchWallets_.length,
            "Causes mismatch"
        );

        maxSupply = initialMaxSupply_;
        mintPriceWei = initialMintPriceWei_;
        devWallet = devWallet_;
        liquidityVault = liquidityVault_;
        coin = AlchemiaCoin(coinAddress_);
        renderer = AlchemiaRenderer(rendererAddress_);
        animationBaseUrl = animationBaseUrl_;

        _setDefaultRoyalty(researchWallets_[0], royaltyBps_);

        for (uint256 i = 0; i < causeNames_.length; i++) {
            if (researchWallets_[i] == address(0)) revert ZeroAddress();
            causes.push(
                Cause({
                    name: causeNames_[i],
                    category: causeCategories_[i],
                    researchWallet: researchWallets_[i],
                    totalRaisedWei: 0,
                    mintCount: 0,
                    active: true
                })
            );
        }
    }

    // -------------------------------------------------------------------------
    // Mint & Single-NFT Upgrade with Two-Phase Liquidity-Threshold Split
    // -------------------------------------------------------------------------

    function mint(uint256 quantity, uint8 causeId) external payable nonReentrant returns (uint256 firstTokenId) {
        if (!mintActive) revert MintPaused();
        if (quantity == 0 || quantity > MAX_MINT_PER_TX) revert InvalidQuantity();
        if (causeId >= causes.length) revert InvalidCause();

        Cause storage cause = causes[causeId];
        if (!cause.active) revert CauseInactive();
        if (maxSupply != 0 && totalSupply() + quantity > maxSupply) revert ExceedsMaxSupply();
        if (msg.value < mintPriceWei * quantity) revert InsufficientPayment();

        (uint256 researchShare, uint256 devShare, uint256 lpShare) = _splitAndRoute(causeId, msg.value);
        cause.mintCount += quantity;

        uint256 perVal = msg.value / quantity;
        uint256 remVal = msg.value - (perVal * quantity);
        uint256 perRes = researchShare / quantity;
        uint256 remRes = researchShare - (perRes * quantity);

        firstTokenId = _nextTokenId;
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            uint256 tVal = i == 0 ? perVal + remVal : perVal;
            uint256 tRes = i == 0 ? perRes + remRes : perRes;

            bytes32 seed = keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    block.number,
                    msg.sender,
                    tokenId,
                    causeId,
                    address(this)
                )
            );

            tokenRecords[tokenId] = TokenRecord({
                seed: seed,
                causeId: causeId,
                mintedAt: uint64(block.timestamp),
                totalValueWei: uint128(tVal),
                researchWei: uint128(tRes),
                sectorsMask: 0,
                lastClaimAt: uint64(block.timestamp)
            });

            // Every minted NFT starts as multi-story architect housing (B1 Basement + 1F + 2F Loft!)
            estateBlueprints[tokenId] = EstateBlueprint({
                houseSize: 1,
                houseFloors: 2,
                extraRoomsMask: 0,
                hasBasement: true,
                gardenHarvests: 0,
                stylePacked: 0,
                updatedAt: uint64(block.timestamp)
            });

            _safeMint(msg.sender, tokenId);

            emit VesselMinted(
                msg.sender,
                tokenId,
                causeId,
                seed,
                tVal,
                tRes,
                i == 0 ? devShare : 0,
                i == 0 ? lpShare : 0,
                complexityTierForValue(tVal),
                totalDonatedWei
            );
        }
    }

    function upgradeVessel(uint256 tokenId) external payable nonReentrant {
        _upgradeSingleToken(tokenId);
    }

    function boostTokenImpact(uint256 tokenId) external payable nonReentrant {
        _upgradeSingleToken(tokenId);
    }

    function _upgradeSingleToken(uint256 tokenId) private {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (msg.value == 0) revert InsufficientPayment();

        TokenRecord storage rec = tokenRecords[tokenId];
        (uint256 researchShare, , ) = _splitAndRoute(rec.causeId, msg.value);

        rec.totalValueWei += uint128(msg.value);
        rec.researchWei += uint128(researchShare);

        emit VesselUpgraded(
            msg.sender,
            tokenId,
            msg.value,
            rec.totalValueWei,
            complexityTierForValue(rec.totalValueWei),
            totalDonatedWei
        );
        emit MetadataUpdate(tokenId);
    }

    function _splitAndRoute(uint8 causeId, uint256 value)
        private
        returns (uint256 researchShare, uint256 devShare, uint256 lpShare)
    {
        Cause storage cause = causes[causeId];

        if (!liquiditySeeded) {
            devShare = (value * BOOTSTRAP_DEV_BPS) / MAX_BPS;
            lpShare = (value * BOOTSTRAP_LP_BPS) / MAX_BPS;
            researchShare = value - devShare - lpShare; // 60%
            liquidityReserveWei += lpShare;
        } else {
            devShare = (value * POST_LP_DEV_BPS) / MAX_BPS;
            researchShare = value - devShare; // 66.67%
        }

        cause.totalRaisedWei += researchShare;
        totalDonatedWei += researchShare;
        totalDevWei += devShare;

        if (researchShare > 0) {
            (bool okR, ) = cause.researchWallet.call{value: researchShare}("");
            if (!okR) revert TransferFailed();
            emit ResearchWalletFunded(causeId, cause.researchWallet, researchShare);
        }
        if (devShare > 0) {
            (bool okD, ) = devWallet.call{value: devShare}("");
            if (!okD) revert TransferFailed();
            emit DevWalletFunded(devWallet, devShare);
        }
    }

    /**
     * @notice Permissionless trigger once `liquidityReserveWei >= liquidityThresholdWei`:
     *         Transfers reserve ETH + freshly minted $ALCH directly to `liquidityVault`
     *         (Uniswap LP manager / router) and transitions mints permanently to 66.67% / 33.33%!
     */
    function seedLiquidity() external nonReentrant {
        if (liquiditySeeded) revert LiquidityAlreadySeeded();
        if (liquidityReserveWei < liquidityThresholdWei) revert LiquidityThresholdNotMet();

        uint256 ethToSeed = liquidityReserveWei;
        liquidityReserveWei = 0;
        liquiditySeeded = true;

        coin.mintFromController(liquidityVault, liquiditySeedCoins);
        (bool ok, ) = liquidityVault.call{value: ethToSeed}("");
        if (!ok) revert TransferFailed();

        emit LiquiditySeeded(liquidityVault, ethToSeed, liquiditySeedCoins);
    }

    // -------------------------------------------------------------------------
    // Sims-Style Modular 3D Lab Sector Expansion & $ALCH Mining Game
    // -------------------------------------------------------------------------

    function miningRatePerHourOf(uint256 tokenId) public view returns (uint256 rate) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        TokenRecord memory rec = tokenRecords[tokenId];

        // Base rate scales with Complexity Tier ($1 -> 5 ALCH/hr up to Tier 5 -> 25 ALCH/hr)
        uint256 tier = complexityTierForValue(rec.totalValueWei);
        rate = tier * 5 ether;

        // Add bonuses from every built Sims-style 3D laboratory sector!
        for (uint8 s = 0; s < SECTOR_COUNT; s++) {
            if ((rec.sectorsMask & (uint8(1) << s)) != 0) {
                rate += sectorMiningBonusPerHour[s];
            }
        }

        // Add bonuses from expanded Architect Estate floors, footprint & homely rooms!
        EstateBlueprint memory bp = estateBlueprints[tokenId];
        if (bp.houseSize > 1) {
            rate += uint256(bp.houseSize - 1) * 3 ether;
        }
        if (bp.houseFloors > 2) {
            rate += uint256(bp.houseFloors - 2) * 4 ether;
        }
        if (bp.extraRoomsMask != 0) {
            rate += _popcount6(bp.extraRoomsMask) * 2 ether;
        }

        // Verified open-science research proofs amplify mining yield (+0.5 ALCH/hr per WU, capped)
        uint256 wuBonus = uint256(researchProofs[tokenId].workUnits) * 0.5 ether;
        if (wuBonus > 40 ether) wuBonus = 40 ether;
        rate += wuBonus;
    }

    function pendingCoinsOf(uint256 tokenId) public view returns (uint256) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        TokenRecord memory rec = tokenRecords[tokenId];
        if (block.timestamp <= rec.lastClaimAt) return 0;
        uint256 elapsed = block.timestamp - rec.lastClaimAt;
        return (miningRatePerHourOf(tokenId) * elapsed) / 3600;
    }

    function _requireTokenExists(uint256 tokenId) private view {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
    }

    function _requireTokenOwner(uint256 tokenId) private view {
        address tokOwner = _ownerOf(tokenId);
        if (tokOwner == address(0)) revert TokenDoesNotExist();
        if (tokOwner != msg.sender) revert NotTokenOwner();
    }

    function _collectAndTitheCoins(uint8 causeId, uint256 cost) private {
        uint256 toResearch = (cost * 2000) / MAX_BPS;
        coin.burnFrom(msg.sender, cost - toResearch);
        if (toResearch > 0) {
            bool ok = coin.transferFrom(msg.sender, causes[causeId].researchWallet, toResearch);
            if (!ok) revert TransferFailed();
            totalCoinsTithedToResearch += toResearch;
        }
    }

    /**
     * @notice Claim mined $ALCH coins from an NFT's active laboratory operations.
     *         Holders can choose a `researchTitheBps` (0..10000) to automatically send
     *         part of their mined $ALCH straight to the cause's research wallet!
     */
    function claimMinedCoins(uint256 tokenId, uint96 researchTitheBps) external nonReentrant {
        _requireTokenOwner(tokenId);
        if (researchTitheBps > MAX_BPS) revert InvalidTithe();

        uint256 accrued = pendingCoinsOf(tokenId);
        if (accrued == 0) revert NothingToClaim();

        TokenRecord storage rec = tokenRecords[tokenId];
        rec.lastClaimAt = uint64(block.timestamp);

        uint256 researchPart = (accrued * researchTitheBps) / MAX_BPS;
        uint256 holderPart = accrued - researchPart;

        if (researchPart > 0) {
            coin.mintFromController(causes[rec.causeId].researchWallet, researchPart);
            totalCoinsTithedToResearch += researchPart;
        }
        if (holderPart > 0) {
            coin.mintFromController(msg.sender, holderPart);
        }

        emit CoinsClaimed(tokenId, msg.sender, holderPart, researchPart);
    }

    /**
     * @notice Build a new Sims-style 3D laboratory wing on your NFT using mined $ALCH coins!
     *         Requires standard ERC-20 approve() (Blockaid-safe, zero hidden token hooks).
     *         20% transfers directly to the Research Wallet; 80% is burned via standard burnFrom.
     */
    function buildLabSectorWithCoins(uint256 tokenId, uint8 sectorId) external nonReentrant {
        _requireTokenOwner(tokenId);
        if (sectorId >= SECTOR_COUNT) revert InvalidSector();

        TokenRecord storage rec = tokenRecords[tokenId];
        uint8 bit = uint8(1) << sectorId;
        if ((rec.sectorsMask & bit) != 0) revert SectorAlreadyBuilt();

        _collectAndTitheCoins(rec.causeId, sectorCoinCosts[sectorId]);

        rec.sectorsMask |= bit;
        emit LabSectorBuilt(tokenId, sectorId, rec.sectorsMask, true);
        emit MetadataUpdate(tokenId);
    }

    /**
     * @notice Build a new Sims-style 3D laboratory wing with ETH (minimum 5x base mint),
     *         also adding its value to the NFT's Complexity Tier & routing the split live!
     */
    function buildLabSectorWithEth(uint256 tokenId, uint8 sectorId) external payable nonReentrant {
        _requireTokenOwner(tokenId);
        if (sectorId >= SECTOR_COUNT) revert InvalidSector();

        TokenRecord storage rec = tokenRecords[tokenId];
        uint8 bit = uint8(1) << sectorId;
        if ((rec.sectorsMask & bit) != 0) revert SectorAlreadyBuilt();
        if (msg.value < mintPriceWei * 5) revert InsufficientPayment();

        (uint256 researchShare, , ) = _splitAndRoute(rec.causeId, msg.value);
        rec.totalValueWei += uint128(msg.value);
        rec.researchWei += uint128(researchShare);
        rec.sectorsMask |= bit;

        emit LabSectorBuilt(tokenId, sectorId, rec.sectorsMask, false);
        emit MetadataUpdate(tokenId);
    }

    // -------------------------------------------------------------------------
    // Multi-Story Architect Home Expansion, Homely Rooms & Wardrobe/Decor Sync
    // -------------------------------------------------------------------------

    function _computeEstateExpansion(
        EstateBlueprint memory cur,
        uint8 targetSize,
        uint8 targetFloors,
        bool enableBasement,
        uint8 newExtraRoomsMask
    ) private pure returns (uint256 coinCost, uint256 unitsAdded, uint8 mergedRooms) {
        if (targetSize < 1 || targetSize > 3 || targetFloors < 1 || targetFloors > 3 || newExtraRoomsMask > 63) {
            revert InvalidEstateConfig();
        }
        uint8 curSize = cur.houseSize == 0 ? 1 : cur.houseSize;
        uint8 curFloors = cur.houseFloors == 0 ? 2 : cur.houseFloors;
        if (targetSize < curSize || targetFloors < curFloors) revert InvalidEstateConfig();

        uint8 addedSizes = targetSize - curSize;
        uint8 addedFloors = targetFloors - curFloors;
        uint8 addedBasement = (enableBasement && !cur.hasBasement) ? 1 : 0;
        mergedRooms = cur.extraRoomsMask | newExtraRoomsMask;
        uint8 addedRooms = uint8(_popcount6(mergedRooms ^ cur.extraRoomsMask));

        unitsAdded = uint256(addedSizes) + uint256(addedFloors) + uint256(addedBasement) + uint256(addedRooms);
        if (unitsAdded == 0) revert InvalidEstateConfig();

        coinCost =
            uint256(addedSizes) * ESTATE_SIZE_COIN_COST +
            uint256(addedFloors + addedBasement) * ESTATE_FLOOR_COIN_COST +
            uint256(addedRooms) * ESTATE_ROOM_COIN_COST;
    }

    /**
     * @notice Expand house footprint (1..3), add stories (up to 3F penthouse), or build any of the
     *         6 homely rooms using mined $ALCH (80% burned, 20% sent straight to research wallet!).
     */
    function expandEstateWithCoins(
        uint256 tokenId,
        uint8 targetSize,
        uint8 targetFloors,
        bool enableBasement,
        uint8 newExtraRoomsMask
    ) external nonReentrant {
        _requireTokenOwner(tokenId);

        EstateBlueprint storage bp = estateBlueprints[tokenId];
        (uint256 cost, , uint8 mergedRooms) = _computeEstateExpansion(
            bp,
            targetSize,
            targetFloors,
            enableBasement,
            newExtraRoomsMask
        );

        _collectAndTitheCoins(tokenRecords[tokenId].causeId, cost);

        bp.houseSize = targetSize;
        bp.houseFloors = targetFloors;
        bp.hasBasement = bp.hasBasement || enableBasement;
        bp.extraRoomsMask = mergedRooms;
        bp.updatedAt = uint64(block.timestamp);

        emit EstateExpanded(tokenId, bp.houseSize, bp.houseFloors, bp.hasBasement, bp.extraRoomsMask, true);
        emit MetadataUpdate(tokenId);
    }

    /**
     * @notice Expand house footprint, floors, or homely rooms with ETH (2x base mint per upgrade unit),
     *         routing ETH live via the Phase 1 / Phase 2 transparent research split.
     */
    function expandEstateWithEth(
        uint256 tokenId,
        uint8 targetSize,
        uint8 targetFloors,
        bool enableBasement,
        uint8 newExtraRoomsMask
    ) external payable nonReentrant {
        _requireTokenOwner(tokenId);

        EstateBlueprint storage bp = estateBlueprints[tokenId];
        (, uint256 unitsAdded, uint8 mergedRooms) = _computeEstateExpansion(
            bp,
            targetSize,
            targetFloors,
            enableBasement,
            newExtraRoomsMask
        );

        if (msg.value < mintPriceWei * 2 * unitsAdded) revert InsufficientPayment();

        TokenRecord storage rec = tokenRecords[tokenId];
        (uint256 researchShare, , ) = _splitAndRoute(rec.causeId, msg.value);
        rec.totalValueWei += uint128(msg.value);
        rec.researchWei += uint128(researchShare);

        bp.houseSize = targetSize;
        bp.houseFloors = targetFloors;
        bp.hasBasement = bp.hasBasement || enableBasement;
        bp.extraRoomsMask = mergedRooms;
        bp.updatedAt = uint64(block.timestamp);

        emit EstateExpanded(tokenId, bp.houseSize, bp.houseFloors, bp.hasBasement, bp.extraRoomsMask, false);
        emit MetadataUpdate(tokenId);
    }

    /**
     * @notice Persist home furnishings, wall/floor styles, researcher & companion wardrobe code,
     *         and botanical greenhouse harvests directly on-chain so visiting neighbors see your look!
     */
    function syncEstateCustomization(
        uint256 tokenId,
        uint64 stylePacked,
        uint32 gardenHarvests,
        string calldata profileCode
    ) external {
        _requireTokenOwner(tokenId);
        if (bytes(profileCode).length > MAX_PROFILE_CODE_BYTES) revert ProfileCodeTooLong();

        EstateBlueprint storage bp = estateBlueprints[tokenId];
        if (bp.houseSize == 0) {
            bp.houseSize = 1;
            bp.houseFloors = 2;
            bp.hasBasement = true;
        }
        bp.stylePacked = stylePacked;
        if (gardenHarvests > bp.gardenHarvests) {
            bp.gardenHarvests = gardenHarvests;
        }
        bp.updatedAt = uint64(block.timestamp);
        if (bytes(profileCode).length > 0) {
            estateProfileCodes[tokenId] = profileCode;
        }

        emit EstateCustomized(tokenId, stylePacked, bp.gardenHarvests);
        emit MetadataUpdate(tokenId);
    }

    function _popcount6(uint8 mask) private pure returns (uint256 c) {
        for (uint8 i = 0; i < 6; i++) {
            if ((mask & (uint8(1) << i)) != 0) c++;
        }
    }

    // -------------------------------------------------------------------------
    // On-Chain Verifiable Open-Science Proof-of-Research Registry
    // -------------------------------------------------------------------------

    function submitResearchProof(
        uint256 tokenId,
        bytes32 proofHash,
        int64 bestEnergyMicro,
        uint32 addedWorkUnits,
        string calldata datasetUri
    ) external {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (msg.sender != ownerOf(tokenId) && msg.sender != owner()) revert NotTokenOwner();
        require(proofHash != bytes32(0) && addedWorkUnits > 0, "Invalid proof");

        ResearchProof storage rp = researchProofs[tokenId];
        if (rp.updatedAt == 0 || bestEnergyMicro < rp.bestEnergyMicro) {
            rp.bestEnergyMicro = bestEnergyMicro;
            rp.proofHash = proofHash;
        }
        rp.workUnits += addedWorkUnits;
        rp.updatedAt = uint64(block.timestamp);

        totalResearchWorkUnits += addedWorkUnits;
        totalDiscoveriesAnchored += 1;

        emit ResearchDiscoveryAnchored(
            tokenId,
            msg.sender,
            proofHash,
            bestEnergyMicro,
            addedWorkUnits,
            datasetUri
        );
        emit MetadataUpdate(tokenId);
    }

    // -------------------------------------------------------------------------
    // Views & Dynamic Metadata
    // -------------------------------------------------------------------------

    function complexityTierForValue(uint256 totalValueWei) public view returns (uint8) {
        uint256 unit = mintPriceWei == 0 ? 0.0004 ether : mintPriceWei;
        if (totalValueWei >= unit * 500) return 5;
        if (totalValueWei >= unit * 100) return 4;
        if (totalValueWei >= unit * 25) return 3;
        if (totalValueWei >= unit * 5) return 2;
        return 1;
    }

    function complexityTierOf(uint256 tokenId) public view returns (uint8) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        return complexityTierForValue(tokenRecords[tokenId].totalValueWei);
    }

    function isInfiniteSupply() external view returns (bool) {
        return maxSupply == 0;
    }

    function currentReactionStage() public view returns (uint8) {
        uint256 d = totalDonatedWei;
        if (d >= stageThresholdsWei[3]) return 5;
        if (d >= stageThresholdsWei[2]) return 4;
        if (d >= stageThresholdsWei[1]) return 3;
        if (d >= stageThresholdsWei[0]) return 2;
        return 1;
    }

    function getAllCauses() external view returns (Cause[] memory) {
        return causes;
    }

    function getLiveImpactSnapshot(uint256 tokenId) public view returns (LiveImpactSnapshot memory snap) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        TokenRecord memory rec = tokenRecords[tokenId];
        Cause memory c = causes[rec.causeId];

        snap = LiveImpactSnapshot({
            seed: rec.seed,
            causeId: rec.causeId,
            mintedAt: rec.mintedAt,
            tokenTotalValueWei: rec.totalValueWei,
            tokenImpactWei: rec.researchWei,
            causeTotalWei: c.totalRaisedWei,
            globalTotalDonatedWei: totalDonatedWei,
            currentSupply: totalSupply(),
            currentMaxSupply: maxSupply,
            isSupplyLocked: supplyConfigLocked,
            reactionStage: currentReactionStage(),
            complexityTier: complexityTierForValue(rec.totalValueWei),
            sectorsMask: rec.sectorsMask,
            pendingCoins: pendingCoinsOf(tokenId),
            miningRatePerHour: miningRatePerHourOf(tokenId),
            workUnits: researchProofs[tokenId].workUnits,
            causeName: c.name,
            researchWallet: c.researchWallet
        });
    }

    function getEstateBlueprint(uint256 tokenId)
        external
        view
        returns (EstateBlueprint memory bp, string memory profileCode)
    {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        bp = estateBlueprints[tokenId];
        if (bp.houseSize == 0) {
            bp.houseSize = 1;
            bp.houseFloors = 2;
            bp.hasBasement = true;
        }
        profileCode = estateProfileCodes[tokenId];
    }

    /**
     * @notice Live on-chain Alchemia Town civic growth metrics synchronized with the 3D neighborhood.
     */
    function townGrowthSummary()
        external
        view
        returns (
            uint256 mintedLabs,
            uint8 townStage,
            uint8 expansionBandsUnlocked,
            bool transitUnlocked
        )
    {
        mintedLabs = totalSupply();
        uint256 n = mintedLabs == 0 ? 1 : mintedLabs;
        townStage = n < 4 ? 1 : n < 10 ? 2 : n < 25 ? 3 : n < 50 ? 4 : 5;
        transitUnlocked = n >= 10;
        uint256 occupiedPlusSurveyed = (n > 1 ? n - 1 : 0) + 4;
        if (occupiedPlusSurveyed > 24) {
            uint256 bands = (occupiedPlusSurveyed - 24 + 23) / 24;
            expansionBandsUnlocked = bands > 255 ? 255 : uint8(bands);
        }
    }

    /**
     * @notice Deterministic neighborhood plot ring, expansion band & street district for any tokenId.
     */
    function neighborhoodPlotOf(uint256 tokenId)
        external
        view
        returns (uint256 plotNumber, uint8 ring, uint8 expansionBand, string memory districtName)
    {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        plotNumber = tokenId;
        (ring, expansionBand, districtName) = renderer.districtInfoForToken(tokenId);
    }

    /**
     * @notice Single-call batch reader for wallets, indexers, and standalone NFT embeds (up to 72 labs).
     */
    function batchGetLiveSnapshots(uint256[] calldata tokenIds)
        external
        view
        returns (
            LiveImpactSnapshot[] memory snaps,
            address[] memory owners,
            EstateBlueprint[] memory estates
        )
    {
        uint256 len = tokenIds.length;
        snaps = new LiveImpactSnapshot[](len);
        owners = new address[](len);
        estates = new EstateBlueprint[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 tid = tokenIds[i];
            if (_ownerOf(tid) == address(0)) continue;
            snaps[i] = getLiveImpactSnapshot(tid);
            owners[i] = ownerOf(tid);
            EstateBlueprint memory bp = estateBlueprints[tid];
            if (bp.houseSize == 0) {
                bp.houseSize = 1;
                bp.houseFloors = 2;
                bp.hasBasement = true;
            }
            estates[i] = bp;
        }
    }

    function animationUrlOf(uint256 tokenId) public view returns (string memory) {
        _requireTokenExists(tokenId);
        TokenRecord memory rec = tokenRecords[tokenId];
        EstateBlueprint memory bp = estateBlueprints[tokenId];

        return renderer.buildAnimationUrl(
            animationBaseUrl,
            tokenId,
            rec.seed,
            rec.causeId,
            complexityTierForValue(rec.totalValueWei),
            rec.sectorsMask,
            totalSupply(),
            bp.houseFloors,
            bp.extraRoomsMask,
            address(this),
            block.chainid
        );
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        TokenRecord memory rec = tokenRecords[tokenId];
        EstateBlueprint memory bp = estateBlueprints[tokenId];
        Cause memory c = causes[rec.causeId];

        return renderer.buildTokenURI(
            AlchemiaRenderer.RenderParams({
                tokenId: tokenId,
                seed: rec.seed,
                causeId: rec.causeId,
                causeName: c.name,
                tokenImpactWei: rec.researchWei,
                globalDonatedWei: totalDonatedWei,
                totalSupply: totalSupply(),
                maxSupply: maxSupply,
                reactionStage: currentReactionStage(),
                complexityTier: complexityTierForValue(rec.totalValueWei),
                sectorsMask: rec.sectorsMask,
                workUnits: researchProofs[tokenId].workUnits,
                houseSize: bp.houseSize == 0 ? 1 : bp.houseSize,
                houseFloors: bp.houseFloors == 0 ? 2 : bp.houseFloors,
                hasBasement: bp.houseSize == 0 ? true : bp.hasBasement,
                extraRoomsMask: bp.extraRoomsMask,
                gardenHarvests: bp.gardenHarvests,
                animationUrl: animationUrlOf(tokenId)
            })
        );
    }

    // -------------------------------------------------------------------------
    // Governance & Supply Configuration
    // -------------------------------------------------------------------------

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        if (supplyConfigLocked) revert SupplyAlreadyLocked();
        if (newMaxSupply != 0 && newMaxSupply < totalSupply()) revert CapBelowCurrentSupply();
        uint256 prev = maxSupply;
        maxSupply = newMaxSupply;
        emit SupplyCapUpdated(prev, newMaxSupply);
    }

    function lockSupplyConfig() external onlyOwner {
        if (supplyConfigLocked) revert SupplyAlreadyLocked();
        supplyConfigLocked = true;
        emit SupplyConfigLocked(maxSupply);
    }

    function setLiquidityConfig(uint256 thresholdWei, uint256 seedCoinsAmount, address payable vault)
        external
        onlyOwner
    {
        if (liquiditySeeded) revert LiquidityAlreadySeeded();
        if (vault == address(0)) revert ZeroAddress();
        liquidityThresholdWei = thresholdWei;
        liquiditySeedCoins = seedCoinsAmount;
        liquidityVault = vault;
        emit LiquidityConfigUpdated(thresholdWei, seedCoinsAmount, vault);
    }

    function setMintConfig(uint256 newMintPriceWei, bool active) external onlyOwner {
        mintPriceWei = newMintPriceWei;
        mintActive = active;
        emit MintConfigUpdated(newMintPriceWei, active);
    }

    function setAnimationBaseUrl(string calldata newBaseUrl) external onlyOwner {
        if (metadataFrozen) revert MetadataAlreadyFrozen();
        animationBaseUrl = newBaseUrl;
        emit BatchMetadataUpdate(1, type(uint256).max);
        emit ContractURIUpdated();
    }

    /**
     * @notice ERC-7572 on-chain collection metadata for OpenSea, Reservoir, and wallets.
     */
    function contractURI() external view returns (string memory) {
        return renderer.buildContractURI(name(), animationBaseUrl);
    }

    /**
     * @notice Permanently locks animationBaseUrl on-chain (prevents any future metadata changes).
     */
    function freezeAnimationBaseUrl() external onlyOwner {
        if (metadataFrozen) revert MetadataAlreadyFrozen();
        metadataFrozen = true;
        emit MetadataFrozen(animationBaseUrl);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC2981)
        returns (bool)
    {
        return interfaceId == _INTERFACE_ID_ERC4906 || super.supportsInterface(interfaceId);
    }
}
