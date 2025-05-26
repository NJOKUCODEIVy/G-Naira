require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify"); // Required for verification
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL, // Use Alchemy URL from .env
      accounts: [process.env.PRIVATE_KEY], // Direct array access
      chainId: 84532,
      gasPrice: 1000000000,
    },
  },
  sourcify: {
  enabled: true
},
  etherscan: {
    apiKey: {
      "base-sepolia": process.env.BASESCAN_API_KEY, // Must match custom chain name
    },
    customChains: [
      {
        network: "base-sepolia", // Standard network name
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
};