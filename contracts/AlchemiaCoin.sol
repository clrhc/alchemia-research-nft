// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title AlchemiaCoin ($ALCH)
 * @notice Pure, Blockaid-safe, zero-tax Ethereum Mainnet ERC-20 coin.
 *         - 0% buy tax, 0% sell tax, 0% transfer tax
 *         - Unmodified standard OpenZeppelin ERC-20 transfers (no blacklists, no pause, no hidden hooks)
 *         - Hard immutable 100,000,000 ALCH maximum supply cap
 *         - One-time immutable NFT controller binding (cannot be swapped after initialization)
 *         - Never burns or moves user tokens without standard ERC-20 allowance / EIP-2612 permit
 */
contract AlchemiaCoin is ERC20, ERC20Burnable, ERC20Permit, Ownable2Step {
    uint256 public constant MAX_SUPPLY = 100_000_000 ether;

    address public nftController;
    uint256 public totalDonatedToResearch;

    event ControllerInitialized(address indexed controller);
    event CoinsDonatedToResearch(
        address indexed donor,
        address indexed researchWallet,
        uint256 amount
    );

    error NotController();
    error ControllerAlreadyInitialized();
    error MaxSupplyExceeded();
    error ZeroAddress();

    constructor() ERC20("Alchemia Coin", "ALCH") ERC20Permit("Alchemia Coin") Ownable(msg.sender) {}

    /**
     * @notice One-time initialization binding the AlchemiaImpactNFT contract as the sole
     *         authorized mining & liquidity-seeding minter. Permanently immutable once set.
     */
    function initializeController(address controller_) external onlyOwner {
        if (nftController != address(0)) revert ControllerAlreadyInitialized();
        if (controller_ == address(0)) revert ZeroAddress();
        nftController = controller_;
        emit ControllerInitialized(controller_);
    }

    /**
     * @notice Mints verified lab-mined $ALCH rewards or initial liquidity pool pairing
     *         strictly within the immutable 100M MAX_SUPPLY cap.
     */
    function mintFromController(address to, uint256 amount) external {
        if (msg.sender != nftController) revert NotController();
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }

    /**
     * @notice Optional helper for holders to donate $ALCH directly to a verified research wallet
     *         with an on-chain event (standard transfer with zero tax).
     */
    function donateToResearch(address researchWallet, uint256 amount) external {
        if (researchWallet == address(0)) revert ZeroAddress();
        _transfer(msg.sender, researchWallet, amount);
        totalDonatedToResearch += amount;
        emit CoinsDonatedToResearch(msg.sender, researchWallet, amount);
    }
}
