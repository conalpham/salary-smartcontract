import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-docgen';
import 'hardhat-contract-sizer';
import 'hardhat-spdx-license-identifier';
import 'hardhat-tracer';
import 'hardhat-abi-exporter';
import '@openzeppelin/hardhat-upgrades';

dotenv.config();

const config: HardhatUserConfig = {
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false,
  },
  contractSizer: {
    runOnCompile: false,
    strict: true,
  },
  spdxLicenseIdentifier: {
    runOnCompile: false,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined ? process.env.REPORT_GAS.toLowerCase() === 'true' : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || '',
    gasPriceApi: process.env.GAS_PRICE_API || '',
    token: 'ETH',
    currency: 'USD',
  },
  abiExporter: {
    runOnCompile: false,
    path: './abi',
    clear: true,
    pretty: true,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.13',
        settings: {
          optimizer: {
            enabled: true,
            runs: 4000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize:
        (process.env.ALLOW_UNLIMITED_CONTRACT_SIZE && process.env.ALLOW_UNLIMITED_CONTRACT_SIZE.toLowerCase() === 'true') || false,
    },
    testnet: {
      allowUnlimitedContractSize:
        (process.env.ALLOW_UNLIMITED_CONTRACT_SIZE && process.env.ALLOW_UNLIMITED_CONTRACT_SIZE.toLowerCase() === 'true') || false,
      url: 'http://localhost:8545',
    },
    bsc: {
      accounts: [(process.env.DEPLOYER_WALLET_PRIVATE_KEY as string) || ''],
      url: 'https://bsc-dataseed1.binance.org/',
    },
    bscTestnet: {
      accounts: [(process.env.DEPLOYER_WALLET_PRIVATE_KEY as string) || ''],
      url: 'https://nodes.3swallet.io/testnet/bnb',
    },
    polygonTestnet: {
      accounts: [(process.env.DEPLOYER_WALLET_PRIVATE_KEY as string) || ''],
      url: 'https://polygon-mumbai.g.alchemy.com/v2/6OxQxYU1tfPztt7kE72YcSdnzZppggaL',
    },
    arbitrumTestnet: {
      accounts: [(process.env.DEPLOYER_WALLET_PRIVATE_KEY as string) || ''],
      url: 'https://arb-goerli.g.alchemy.com/v2/lI9ZVZfd1iTAlc-sYsdASQzd9ehZiFqU',
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BSCSCAN_API_KEY || '',
      bsc: process.env.BSCSCAN_API_KEY || '',
    },
  },
};

export default config;
