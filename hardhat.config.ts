import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';

dotenv.config();

const MAINNET_RPC_URL = process.env.ALCHEMY_MAINNET_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/your-api-key';
const { FORKING_BLOCK_NUMBER } = process.env;
const RINKEBY_RPC_URL = process.env.RINKEBY_RPC_URL || 'https://eth-rinkeby.alchemyapi.io/v2/your-api-key';
const KOVAN_RPC_URL = process.env.KOVAN_RPC_URL || 'https://eth-kovan.alchemyapi.io/v2/your-api-key';

// Your API key for Etherscan, obtain one at https://etherscan.io/
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'Your etherscan API key';
const MNEMONIC = process.env.MNEMONIC || 'Your mnemonic';
const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: 'hardhat',
  networks: {
    localhost: {
      chainId: 31337,
    },
    hardhat: {
      // If you want to do some forking set `enabled` to true
      forking: {
        url: MAINNET_RPC_URL,
        blockNumber: Number(FORKING_BLOCK_NUMBER),
        enabled: false,
      },
      chainId: 31337,
    },
    kovan: {
      url: KOVAN_RPC_URL,
      // accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 42,
    },
    rinkeby: {
      url: RINKEBY_RPC_URL,
      // accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 4,
    },
  },
  etherscan: {
    // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
    apiKey: {
      rinkeby: ETHERSCAN_API_KEY,
      kovan: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
    // outputFile: 'gas-report.txt',
    noColors: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  contractSizer: {
    runOnCompile: false,
    only: ['APIConsumer', 'KeepersCounter', 'PriceConsumerV3', 'RandomNumberConsumer'],
  },
  mocha: {
    timeout: 200000, // 200 seconds max for running tests
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
};

export default config;
