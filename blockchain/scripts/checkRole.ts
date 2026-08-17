import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect({ network: "amoy" });
  const [signer] = await ethers.getSigners();

  const contractAddress = "0x46Cc4B537fd6B74650A21B6f5f82FE8146Fb0F66";
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = Verifier.attach(contractAddress);

  const ISSUER_ROLE = await verifier.ISSUER_ROLE();
  const DEFAULT_ADMIN_ROLE = await verifier.DEFAULT_ADMIN_ROLE();

  const hasIssuer = await verifier.hasRole(ISSUER_ROLE, signer.address);
  const hasAdmin = await verifier.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  console.log("Wallet:", signer.address);
  console.log("Has ISSUER_ROLE:", hasIssuer);
  console.log("Has DEFAULT_ADMIN_ROLE:", hasAdmin);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});