// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title AlchemiaRenderer
 * @notice Standalone pure on-chain Swiss Architectural Blueprint SVG & ERC-721 JSON renderer.
 *         Keeps AlchemiaImpactNFT well under EIP-170 while visually reflecting live complexity
 *         tiers, 6 modular lab wings, multi-story architect estate expansions (B1/1F/2F/3F +
 *         6 homely rooms), town plot districts, botanical harvests, and verified protein folds.
 */
contract AlchemiaRenderer {
    using Strings for uint256;

    struct RenderParams {
        uint256 tokenId;
        bytes32 seed;
        uint8 causeId;
        string causeName;
        uint256 tokenImpactWei;
        uint256 globalDonatedWei;
        uint256 totalSupply;
        uint256 maxSupply;
        uint8 reactionStage;
        uint8 complexityTier;
        uint8 sectorsMask;
        uint32 workUnits;
        uint8 houseSize;
        uint8 houseFloors;
        bool hasBasement;
        uint8 extraRoomsMask;
        uint32 gardenHarvests;
        string animationUrl;
    }

    struct DerivedTraits {
        string vessel;
        string familiar;
        string familiarKind;
        string palette;
        string primaryHex;
        string secondaryHex;
        string accentHex;
        uint8 vesselIdx;
        uint8 familiarIdx;
    }

    function deriveTraits(bytes32 seed) public pure returns (DerivedTraits memory t) {
        uint256 h = uint256(seed);
        uint8 vesselIdx = uint8(h % 5);
        uint8 fRoll = uint8((h >> 8) % 100);
        uint8 palIdx = uint8((h >> 16) % 9);

        t.vesselIdx = vesselIdx;
        string[5] memory vessels = [
            "Erlenmeyer Flask",
            "Round Lab Orb",
            "Glass Chalice",
            "Twin Glass Crucible",
            "Tall Glass Spire"
        ];
        t.vessel = vessels[vesselIdx];

        if (fRoll < 16) {
            t.familiarIdx = 0; t.familiar = "Tuxedo Cat"; t.familiarKind = "Cat";
        } else if (fRoll < 32) {
            t.familiarIdx = 1; t.familiar = "Siamese Cat"; t.familiarKind = "Cat";
        } else if (fRoll < 47) {
            t.familiarIdx = 2; t.familiar = "Calico Kitten"; t.familiarKind = "Cat";
        } else if (fRoll < 63) {
            t.familiarIdx = 3; t.familiar = "Shiba Inu"; t.familiarKind = "Dog";
        } else if (fRoll < 79) {
            t.familiarIdx = 4; t.familiar = "Silver Sighthound"; t.familiarKind = "Dog";
        } else if (fRoll < 94) {
            t.familiarIdx = 5; t.familiar = "Yellow Lab Pup"; t.familiarKind = "Dog";
        } else {
            t.familiarIdx = 6; t.familiar = "Cat & Dog Pair"; t.familiarKind = "Duo";
        }

        string[9] memory palNames = [
            "Opal Cobalt", "Mercury Rose", "Aether Mint", "Solar Platinum",
            "Prism Violet", "Cinnabar Coral", "Glacier Cyan", "Liquid Aurum", "Iridescent Prism"
        ];
        string[9] memory pHex = [
            "#5B8DEF", "#EC6EAD", "#34D399", "#F59E0B",
            "#8B5CF6", "#FB7185", "#06B6D4", "#D97706", "#6366F1"
        ];
        string[9] memory sHex = [
            "#8FD3F4", "#93A5CF", "#60A5FA", "#F97316",
            "#38BDF8", "#FBBF24", "#818CF8", "#94A3B8", "#14B8A6"
        ];
        string[9] memory aHex = [
            "#F472B6", "#38BDF8", "#F59E0B", "#6366F1",
            "#FB7185", "#2DD4BF", "#F43F5E", "#10B981", "#EC4899"
        ];
        t.palette = palNames[palIdx];
        t.primaryHex = pHex[palIdx];
        t.secondaryHex = sHex[palIdx];
        t.accentHex = aHex[palIdx];
    }

    /**
     * @notice Pure deterministic neighborhood district mapper matching `neighborhoodLayout.ts`!
     *         tokenId #1 -> Central Founder Plaza, #2..#9 -> Ring 1 Inner Streets,
     *         #10..#25 -> Ring 2 Park Boulevards, #26+ -> Ring 3+ Outer Expansion Districts.
     */
    function districtInfoForToken(uint256 tokenId)
        public
        pure
        returns (uint8 ring, uint8 expansionBand, string memory districtName)
    {
        if (tokenId <= 1) {
            return (1, 0, "Central Plaza");
        }
        uint256 plotIdx = tokenId - 2;
        if (plotIdx < 8) {
            string[8] memory inner = [
                "Willow Lane", "Maple Lane", "Willow Lane", "Maple Lane",
                "Oakwood Street", "Oakwood Street", "Main Street", "Main Street"
            ];
            return (1, 0, inner[plotIdx]);
        }
        if (plotIdx < 24) {
            uint256 side = (plotIdx - 8) % 4;
            string[4] memory suburb = [
                "East Park Blvd", "South Blossom Ave", "West Park Blvd", "North Orchard Ave"
            ];
            return (2, 0, suburb[side]);
        }
        uint256 band = (plotIdx - 24) / 24;
        uint8 bandU8 = band > 255 ? 255 : uint8(band);
        if (band == 0) return (3, 0, "Skyline Heights");
        if (band == 1) return (3, 1, "Innovation Ridge");
        if (band == 2) return (3, 2, "Horizon Estates");
        if (band == 3) return (3, 3, "Starlight Commons");
        return (3, bandU8, string.concat("Frontier Sector ", (band - 3).toString()));
    }

    function buildAnimationUrl(
        string calldata baseUrl,
        uint256 tokenId,
        bytes32 seed,
        uint8 causeId,
        uint8 complexityTier,
        uint8 sectorsMask,
        uint256 totalSupply,
        uint8 houseFloors,
        uint8 extraRoomsMask,
        address nftContract,
        uint256 chainId
    ) external pure returns (string memory) {
        uint8 floors = houseFloors == 0 ? 2 : houseFloors;
        return string.concat(
            baseUrl,
            "?tokenId=", tokenId.toString(),
            "&seed=", Strings.toHexString(uint256(seed), 32),
            "&cause=", uint256(causeId).toString(),
            "&tier=", uint256(complexityTier).toString(),
            "&sectors=", uint256(sectorsMask).toString(),
            "&supply=", totalSupply.toString(),
            "&floors=", uint256(floors).toString(),
            "&rooms=", uint256(extraRoomsMask).toString(),
            "&contract=", Strings.toHexString(uint160(nftContract), 20),
            "&chainId=", chainId.toString()
        );
    }

    function buildTokenURI(RenderParams calldata p) external pure returns (string memory) {
        DerivedTraits memory t = deriveTraits(p.seed);
        (, , string memory district) = districtInfoForToken(p.tokenId);
        string memory archLabel = _architectureLabel(p.houseSize, p.houseFloors, p.hasBasement);
        string memory svg = _renderSVG(p, t, district, archLabel);
        string memory imageUri = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));

        string memory supplyLabel = p.maxSupply == 0
            ? "Open"
            : string.concat("Capped (", p.maxSupply.toString(), ")");

        uint256 sectorCount = _popcount(p.sectorsMask);
        uint256 roomCount = _popcount(p.extraRoomsMask);

        string memory attrsA = string.concat(
            '{"trait_type":"Vessel","value":"', t.vessel, '"},',
            '{"trait_type":"Pet","value":"', t.familiar, '"},',
            '{"trait_type":"Species","value":"', t.familiarKind, '"},',
            '{"trait_type":"Palette","value":"', t.palette, '"},',
            '{"trait_type":"Cause","value":"', p.causeName, '"},',
            '{"trait_type":"Town District","value":"', district, '"},',
            '{"trait_type":"Architecture","value":"', archLabel, '"},'
        );

        string memory attrsB = string.concat(
            '{"trait_type":"Supply","value":"', supplyLabel, '"},',
            '{"trait_type":"Detail Level","value":"Level ', uint256(p.complexityTier).toString(), '/5"},',
            '{"display_type":"number","trait_type":"Built Lab Wings","value":', sectorCount.toString(), '},',
            '{"display_type":"number","trait_type":"Homely Rooms","value":', roomCount.toString(), '},',
            '{"display_type":"number","trait_type":"Botanical Harvests","value":', uint256(p.gardenHarvests).toString(), '},',
            '{"display_type":"number","trait_type":"Verified Research WUs","value":', uint256(p.workUnits).toString(), '},',
            '{"display_type":"number","trait_type":"Town Population","value":', p.totalSupply.toString(), '}'
        );

        string memory json = string.concat(
            '{"name":"Alchemia Lab #', p.tokenId.toString(),
            '","description":"Interactive multi-story 3D architectural glass laboratory in Alchemia Town that funds open science, folds real RCSB PDB mini-proteins, mines zero-tax ALCH coins, and grows with buildable wings, rooms, gardens, and neighbors. Cause: ',
            p.causeName, '.","image":"', imageUri,
            '","animation_url":"', p.animationUrl, '","attributes":[',
            attrsA, attrsB, ']}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _architectureLabel(uint8 size, uint8 floors, bool hasBasement) private pure returns (string memory) {
        uint8 safeFloors = floors == 0 ? 2 : (floors > 3 ? 3 : floors);
        string memory sizeName = size >= 3 ? "Grand Estate" : size == 2 ? "Atrium Villa" : "Architect Home";
        string memory floorTag = hasBasement
            ? string.concat("B1+", uint256(safeFloors).toString(), "F")
            : string.concat(uint256(safeFloors).toString(), "F");
        return string.concat(floorTag, " ", sizeName);
    }

    function _renderSVG(
        RenderParams calldata p,
        DerivedTraits memory t,
        string memory district,
        string memory archLabel
    ) private pure returns (string memory) {
        uint256 boost = (p.globalDonatedWei * 68) / 5 ether;
        if (boost > 68) boost = 68;
        uint256 liqY = 382 - ((24 + boost) * 140) / 100;
        string memory flaskD = _flaskD(t.vesselIdx);

        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">',
            '<defs>',
            '<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#edf1f7"/></linearGradient>',
            '<linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="', t.secondaryHex, '"/><stop offset="1" stop-color="', t.primaryHex, '"/></linearGradient>',
            '<pattern id="g" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0v30" fill="none" stroke="#cbd5e1" stroke-opacity=".35" stroke-width=".8"/></pattern>',
            '<clipPath id="c"><path d="', flaskD, '"/></clipPath></defs>',
            '<rect width="600" height="600" fill="url(#b)"/><rect width="600" height="600" fill="url(#g)"/>',
            _blueprintFrameAndPlinth(t, p.complexityTier),
            _sectorNodesSvg(p.sectorsMask),
            '<g clip-path="url(#c)"><rect x="170" y="', liqY.toString(), '" width="260" height="250" fill="url(#l)" fill-opacity=".88"/>',
            '<ellipse cx="300" cy="', liqY.toString(), '" rx="95" ry="9" fill="#ffffff" fill-opacity=".5"/></g>',
            '<path d="', flaskD, '" fill="none" stroke="#475569" stroke-width="2.6"/>',
            '<path d="M286 178v72" stroke="#ffffff" stroke-opacity=".65" stroke-width="4" stroke-linecap="round"/>',
            _familiarSvg(t.familiarIdx, p.sectorsMask, p.complexityTier, t.accentHex),
            _titleBlockSvg(p, t, district, archLabel),
            '</svg>'
        );
    }

    function _blueprintFrameAndPlinth(DerivedTraits memory t, uint8 tier) private pure returns (string memory) {
        string memory tierArc = tier >= 3
            ? string.concat('<circle cx="300" cy="272" r="204" fill="none" stroke="', t.primaryHex, '" stroke-opacity=".28" stroke-dasharray="2 8"/>')
            : "";
        return string.concat(
            '<path d="M24 44V24h20M556 24h20v20M24 556v20h20M556 576h20v-20" fill="none" stroke="#94a3b8" stroke-width="1.5"/>',
            '<ellipse cx="300" cy="398" rx="184" ry="34" fill="#ffffff" fill-opacity=".86" stroke="#cbd5e1" stroke-width="1.4"/>',
            '<ellipse cx="300" cy="394" rx="150" ry="25" fill="', t.secondaryHex, '" fill-opacity=".16" stroke="', t.primaryHex, '" stroke-opacity=".42"/>',
            '<g fill="none" stroke="#94a3b8" stroke-opacity=".5"><circle cx="300" cy="272" r="176" stroke-dasharray="4 6"/><circle cx="300" cy="272" r="144"/>',
            '<ellipse cx="300" cy="272" rx="186" ry="62" transform="rotate(-24 300 272)" stroke="', t.primaryHex, '" stroke-opacity=".48"/>',
            '<ellipse cx="300" cy="272" rx="186" ry="62" transform="rotate(26 300 272)" stroke="', t.secondaryHex, '" stroke-opacity=".48"/></g>',
            tierArc,
            '<circle cx="144" cy="196" r="6" fill="', t.accentHex, '"/><circle cx="458" cy="342" r="5" fill="', t.primaryHex, '"/>',
            '<g transform="translate(300,104)" fill="none" stroke="', t.primaryHex, '" stroke-width="1.6" stroke-opacity=".8">',
            '<path d="M-24 0c8-16 16-16 24 0s16 16 24 0"/><circle cx="-16" cy="-7" r="3" fill="', t.accentHex, '"/>',
            '<circle cx="0" cy="0" r="3" fill="', t.primaryHex, '"/><circle cx="16" cy="7" r="3" fill="', t.secondaryHex, '"/></g>'
        );
    }

    function _sectorNodesSvg(uint8 mask) private pure returns (string memory) {
        string[6] memory coords = [
            "106,158", "494,258", "106,338", "494,358", "494,158", "300,66"
        ];
        string[6] memory colors = [
            "#38BDF8", "#6366F1", "#10B981", "#F472B6", "#8B5CF6", "#F59E0B"
        ];
        string[6] memory tags = ["CRYO", "MINE", "SOLR", "PETS", "SPIR", "DOME"];

        string memory out = '<g font-family="monospace" font-size="8" text-anchor="middle">';
        for (uint8 i = 0; i < 6; i++) {
            bool built = (mask & (uint8(1) << i)) != 0;
            out = string.concat(
                out,
                '<g transform="translate(', coords[i], ')">',
                '<circle r="17" fill="#ffffff" fill-opacity="', built ? ".95" : ".5",
                '" stroke="', built ? colors[i] : "#cbd5e1", '" stroke-width="', built ? "2" : "1", '"/>',
                '<text y="3" fill="', built ? "#1e293b" : "#94a3b8", '">', tags[i], '</text></g>'
            );
        }
        return string.concat(out, '</g>');
    }

    function _titleBlockSvg(
        RenderParams calldata p,
        DerivedTraits memory t,
        string memory district,
        string memory archLabel
    ) private pure returns (string memory) {
        return string.concat(
            '<rect x="34" y="460" width="532" height="106" rx="18" fill="#ffffff" fill-opacity=".86" stroke="#cbd5e1"/>',
            '<text x="56" y="489" font-family="sans-serif" font-size="14" font-weight="600" fill="#1a1f2c">ALCHEMIA LAB #',
            p.tokenId.toString(), ' - ', t.familiar, ' (', district, ')</text>',
            '<text x="56" y="514" font-family="sans-serif" font-size="12" fill="#5a6478">Level ',
            uint256(p.complexityTier).toString(), '/5 | ', _popcount(p.sectorsMask).toString(),
            '/6 Rooms | ', archLabel, '</text>',
            '<text x="56" y="538" font-family="monospace" font-size="11" fill="#334155">FOLDS: ',
            uint256(p.workUnits).toString(), ' | TOWN: ', p.totalSupply.toString(),
            ' LABS | RESEARCH: ', _formatEth3(p.globalDonatedWei), ' ETH</text>'
        );
    }

    function _flaskD(uint8 idx) private pure returns (string memory) {
        string[5] memory paths = [
            "M276 146h48v64l70 142q8 26-18 26H224q-26 0-18-26l70-142z",
            "M278 144h44v70a90 90 0 1 1-44 0z",
            "M252 162h96l20 164-42 52h-52l-42-52z",
            "M280 140h40v62c48 13 63 65 30 96 38 32 22 80-24 80h-52c-46 0-62-48-24-80-33-31-18-83 30-96z",
            "M284 134h32v60l40 54-19 36 46 69q6 22-19 22H236q-25 0-19-22l46-69-19-36 40-54z"
        ];
        return paths[idx];
    }

    function _familiarSvg(
        uint8 idx,
        uint8 sectorsMask,
        uint8 tier,
        string memory accentHex
    ) private pure returns (string memory) {
        string memory cat = string.concat(
            '<g transform="translate(390,312)" fill="#252c3b" fill-opacity=".9">',
            '<path d="M18 32L12 8l18 12h18L66 8l-6 24c8 14 6 40-4 50H22c-10-10-12-36-4-50z"/>',
            '<circle cx="30" cy="38" r="3" fill="', accentHex, '"/><circle cx="48" cy="38" r="3" fill="', accentHex, '"/></g>'
        );
        string memory dog = string.concat(
            '<g transform="translate(124,314)" fill="#252c3b" fill-opacity=".9">',
            '<path d="M22 28L16 6l18 14h18l16-10-6 24c10 10 8 38-6 46H24c-12-10-12-36-2-52z"/>',
            '<circle cx="34" cy="38" r="3" fill="', accentHex, '"/><circle cx="50" cy="38" r="3" fill="', accentHex, '"/></g>'
        );
        if (idx == 6 || tier >= 4 || (sectorsMask & 8) != 0) return string.concat(cat, dog);
        if (idx <= 2) return cat;
        return dog;
    }

    /**
     * @notice Builds ERC-7572 collection-level metadata JSON (`contractURI`) fully on-chain
     *         with a minimalist pure-white Swiss architectural cat-flask emblem SVG.
     */
    function buildContractURI(string calldata collectionName, string calldata externalLink)
        external
        pure
        returns (string memory)
    {
        string memory emblemSvg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
            '<rect width="256" height="256" rx="56" fill="#ffffff"/>',
            '<circle cx="128" cy="128" r="102" fill="#f7f9fd" stroke="#cbd5e1" stroke-width="2"/>',
            '<path d="M92 92L82 54l26 20h40l26-20-10 38c14 16 20 40 16 64-6 30-26 44-52 44s-46-14-52-44c-4-24 2-48 16-64z" fill="#ffffff" stroke="#334155" stroke-width="5"/>',
            '<path d="M84 152c14 8 30-8 44 0s30 8 44 0c-4 24-20 38-44 38s-40-14-44-38z" fill="#5b8def" fill-opacity=".35"/>',
            '<circle cx="110" cy="116" r="5" fill="#1a1f2c"/><circle cx="146" cy="116" r="5" fill="#1a1f2c"/>',
            '</svg>'
        );
        string memory json = string.concat(
            '{"name":"',
            collectionName,
            '","description":"Interactive 3D architectural glass labs in living Alchemia Town that fund open scientific research, fold real proteins in your browser, let you expand multi-story homes & gardens, care for your pet, and mine 0% tax ALCH coins.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(emblemSvg)),
            '","external_link":"',
            externalLink,
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _popcount(uint8 mask) private pure returns (uint256 c) {
        for (uint8 i = 0; i < 6; i++) {
            if ((mask & (uint8(1) << i)) != 0) c++;
        }
    }

    function _formatEth3(uint256 weiAmount) private pure returns (string memory) {
        uint256 whole = weiAmount / 1e18;
        uint256 frac = (weiAmount % 1e18) / 1e15;
        string memory f = frac.toString();
        if (frac < 10) f = string.concat("00", f);
        else if (frac < 100) f = string.concat("0", f);
        return string.concat(whole.toString(), ".", f);
    }
}
