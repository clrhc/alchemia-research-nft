// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title AlchemiaRenderer
 * @notice Standalone pure on-chain SVG & ERC-721 JSON metadata generator.
 *         Keeps AlchemiaImpactNFT lean on Ethereum Mainnet while reflecting live
 *         complexity tiers, built Sims-style lab sectors, and verified research work units.
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
            "Erlenmeyer Alembic",
            "Florence Retort Orb",
            "Celestial Graduated Chalice",
            "Twin Klein Crucible",
            "Grand Distillation Spire"
        ];
        t.vessel = vessels[vesselIdx];

        if (fRoll < 16) {
            t.familiarIdx = 0; t.familiar = "Alchemist Tuxedo Cat"; t.familiarKind = "Cat";
        } else if (fRoll < 32) {
            t.familiarIdx = 1; t.familiar = "Astral Siamese Cat"; t.familiarKind = "Cat";
        } else if (fRoll < 47) {
            t.familiarIdx = 2; t.familiar = "Nebula Calico Kitten"; t.familiarKind = "Cat";
        } else if (fRoll < 63) {
            t.familiarIdx = 3; t.familiar = "Quantum Shiba Hound"; t.familiarKind = "Dog";
        } else if (fRoll < 79) {
            t.familiarIdx = 4; t.familiar = "Celestial Sighthound"; t.familiarKind = "Dog";
        } else if (fRoll < 94) {
            t.familiarIdx = 5; t.familiar = "Labrador Catalyst Pup"; t.familiarKind = "Dog";
        } else {
            t.familiarIdx = 6; t.familiar = "Harmonic Cat & Dog Duo"; t.familiarKind = "Duo";
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

    function buildTokenURI(RenderParams calldata p) external pure returns (string memory) {
        DerivedTraits memory t = deriveTraits(p.seed);
        string memory svg = _renderSVG(p, t);
        string memory imageUri = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));

        string memory supplyLabel = p.maxSupply == 0
            ? "Infinite"
            : string.concat("Capped (", p.maxSupply.toString(), ")");

        uint256 sectorCount = _popcount(p.sectorsMask);

        string memory json = string.concat(
            '{"name":"Alchemia Lab #', p.tokenId.toString(),
            '","description":"Living 3D Ethereum architectural alchemical laboratory funding real-world research, running live protein folding & $ALCH mining operations, and expandable with modular 3D lab wings. Cause: ',
            p.causeName, '.","image":"', imageUri,
            '","animation_url":"', p.animationUrl, '","attributes":[',
            '{"trait_type":"Vessel","value":"', t.vessel, '"},',
            '{"trait_type":"Familiar","value":"', t.familiar, '"},',
            '{"trait_type":"Species","value":"', t.familiarKind, '"},',
            '{"trait_type":"Palette","value":"', t.palette, '"},',
            '{"trait_type":"Cause","value":"', p.causeName, '"},',
            '{"trait_type":"Supply","value":"', supplyLabel, '"},',
            '{"trait_type":"Complexity Tier","value":"Tier ', uint256(p.complexityTier).toString(), '/5"},',
            '{"display_type":"number","trait_type":"Built Lab Wings","value":', sectorCount.toString(), '},',
            '{"display_type":"number","trait_type":"Verified Research WUs","value":', uint256(p.workUnits).toString(), '}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _renderSVG(RenderParams calldata p, DerivedTraits memory t) private pure returns (string memory) {
        uint256 boost = (p.globalDonatedWei * 68) / 5 ether;
        if (boost > 68) boost = 68;
        uint256 liqY = 395 - ((22 + boost) * 150) / 100;
        string memory flaskD = _flaskD(t.vesselIdx);

        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">',
            '<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e8ecf2"/></linearGradient>',
            '<linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="', t.primaryHex, '"/><stop offset="1" stop-color="', t.secondaryHex, '"/></linearGradient>',
            '<clipPath id="c"><path d="', flaskD, '"/></clipPath></defs>',
            '<rect width="600" height="600" fill="url(#b)"/>',
            '<g fill="none" stroke="#c0c7d4"><circle cx="300" cy="285" r="210" stroke-dasharray="4 6"/><circle cx="300" cy="285" r="172"/>',
            '<ellipse cx="300" cy="285" rx="198" ry="72" transform="rotate(-24 300 285)" stroke="', t.primaryHex, '" stroke-opacity=".5"/>',
            '<ellipse cx="300" cy="285" rx="198" ry="72" transform="rotate(28 300 285)" stroke="', t.secondaryHex, '" stroke-opacity=".5"/></g>',
            '<circle cx="136" cy="212" r="7" fill="', t.accentHex, '"/><circle cx="468" cy="356" r="6" fill="', t.primaryHex, '"/>',
            '<g clip-path="url(#c)"><rect x="170" y="', liqY.toString(), '" width="260" height="260" fill="url(#l)"/>',
            '<ellipse cx="300" cy="', liqY.toString(), '" rx="95" ry="9" fill="#fff" fill-opacity=".42"/></g>',
            '<path d="', flaskD, '" fill="none" stroke="#64748b" stroke-width="3"/>',
            _familiarSvg(t.familiarIdx, t.accentHex),
            '<rect x="34" y="462" width="532" height="100" rx="18" fill="#fff" fill-opacity=".78" stroke="#d5dbe5"/>',
            '<text x="56" y="494" font-family="sans-serif" font-size="14" font-weight="600" fill="#1e222b">ALCHEMIA #', p.tokenId.toString(), ' - ', t.familiar, '</text>',
            '<text x="56" y="522" font-family="sans-serif" font-size="12" fill="#5b6475">Tier ', uint256(p.complexityTier).toString(), '/5 | ', _popcount(p.sectorsMask).toString(), ' Lab Wings | ', p.causeName, '</text>',
            '<text x="56" y="546" font-family="monospace" font-size="12" fill="#2c3444">WU: ', uint256(p.workUnits).toString(), ' | LIVE RESEARCH: ', _formatEth3(p.globalDonatedWei), ' ETH</text></svg>'
        );
    }

    function _flaskD(uint8 idx) private pure returns (string memory) {
        string[5] memory paths = [
            "M276 155h48v67l72 146q8 27-18 27H222q-26 0-18-27l72-146z",
            "M278 152h44v73a92 92 0 1 1-44 0z",
            "M250 170h100l22 170-44 55h-56l-44-55z",
            "M280 148h40v64c50 13 65 68 32 100 40 33 23 83-26 83h-52c-49 0-66-50-26-83-33-32-18-87 32-100z",
            "M284 142h32v63l42 57-20 38 48 72q6 23-20 23H234q-26 0-20-23l48-72-20-38 42-57z"
        ];
        return paths[idx];
    }

    function _familiarSvg(uint8 idx, string memory accentHex) private pure returns (string memory) {
        string memory cat = string.concat(
            '<g transform="translate(394,316)" fill="#2a3140" fill-opacity=".88">',
            '<path d="M18 32L12 8l18 12h18L66 8l-6 24c8 14 6 40-4 50H22c-10-10-12-36-4-50z"/>',
            '<circle cx="30" cy="38" r="3" fill="', accentHex, '"/><circle cx="48" cy="38" r="3" fill="', accentHex, '"/></g>'
        );
        string memory dog = string.concat(
            '<g transform="translate(122,318)" fill="#2a3140" fill-opacity=".88">',
            '<path d="M22 28L16 6l18 14h18l16-10-6 24c10 10 8 38-6 46H24c-12-10-12-36-2-52z"/>',
            '<circle cx="34" cy="38" r="3" fill="', accentHex, '"/><circle cx="50" cy="38" r="3" fill="', accentHex, '"/></g>'
        );
        if (idx <= 2) return cat;
        if (idx <= 5) return dog;
        return string.concat(cat, dog);
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
