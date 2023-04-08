import { parseEther } from 'ethers/lib/utils';
import { ethers, network, run } from 'hardhat';

const main = async () => {
  // Get network data from Hardhat config (see hardhat.config.ts).
  const networkName = network.name;

  const admin = new ethers.Wallet(process.env.ADMIN_WALLET_PRIVATE_KEY ?? '', ethers.provider);

  // Check if the network is supported.
  if (networkName === 'bscTestnet' || networkName === 'bsc') {
    console.log(`Deploying to ${networkName} network...`);

    // Compile contracts.
    await run('compile');
    console.log('Compiled contracts...');

    // Deploy contracts.
    const TooUpToken = await ethers.getContractFactory('TooUpToken');

    const constructorArgs: [string, string, string, string] = ['Too Up Coin', 'TUC', parseEther('1000000000').toString(), admin.address];
    const contract = await TooUpToken.deploy(...constructorArgs);

    // Wait for the contract to be deployed before exiting the script.
    await contract.deployed();
    console.log(`Deployed to ${contract.address}`);

    console.log('Wait to verify contract');
    await new Promise((resolve) => {
      setTimeout(resolve, 60 * 1000);
    });

    await run('verify:verify', {
      address: contract.address,
      constructorArguments: constructorArgs,
      contract: 'contracts/TooUpToken.sol:TooUpToken',
    });
  } else {
    console.log(`Deploying to ${networkName} network is not supported...`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
