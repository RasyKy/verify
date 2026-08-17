import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "dotenv/config";

const { ALCHEMY_AMOY_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
  },
  networks: {
    ...(ALCHEMY_AMOY_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? {
          amoy: {
            type: "http" as const,
            url: ALCHEMY_AMOY_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            chainId: 80002,
          },
        }
      : {}),
  },
});