// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TooUpToken is ERC20 {
  constructor(
    string memory name,
    string memory symbol,
    uint256 initialSupply,
    address owner
  ) ERC20(name, symbol) {
    _mint(owner, initialSupply);
  }
}
