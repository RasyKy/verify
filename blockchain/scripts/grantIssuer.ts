import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect({ network: "amoy" });
  const [signer] = await ethers.getSigners();

  const contractAddress = "0x46Cc4B537fd6B74650A21B6f5f82FE8146Fb0F66";
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = Verifier.attach(contractAddress);

  const ISSUER_ROLE = await verifier.ISSUER_ROLE();

  console.log("Granting ISSUER_ROLE to:", signer.address);
  const tx = await verifier.grantRole(ISSUER_ROLE, signer.address);
  await tx.wait();

  console.log("Done. Tx hash:", tx.hash);

  const hasIssuer = await verifier.hasRole(ISSUER_ROLE, signer.address);
  console.log("Has ISSUER_ROLE now:", hasIssuer);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});