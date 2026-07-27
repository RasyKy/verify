import { network } from "hardhat";
import { expect } from "chai";
import { keccak256, toUtf8Bytes } from "ethers";

describe("Verifier", function () {
  async function deployFixture() {
    const { ethers } = await network.connect();
    const [admin, issuer, other] = await ethers.getSigners();
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    return { verifier, admin, issuer, other, ethers };
  }

  it("grants DEFAULT_ADMIN_ROLE to deployer", async function () {
    const { verifier, admin } = await deployFixture();
    const DEFAULT_ADMIN_ROLE = await verifier.DEFAULT_ADMIN_ROLE();
    expect(await verifier.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
  });

  it("allows admin to grant ISSUER_ROLE, then issuer can issue", async function () {
    const { verifier, admin, issuer } = await deployFixture();
    const ISSUER_ROLE = await verifier.ISSUER_ROLE();
    await verifier.connect(admin).grantRole(ISSUER_ROLE, issuer.address);

    const hash = keccak256(toUtf8Bytes("certificate-1"));
    await verifier.connect(issuer).issue(hash, 0);

    const result = await verifier.verify(hash);
    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(false);
  });

  it("rejects issue() from a non-issuer wallet", async function () {
    const { verifier, other, ethers } = await deployFixture();
    const hash = keccak256(toUtf8Bytes("certificate-2"));
    await expect(verifier.connect(other).issue(hash, 0)).to.revert(ethers);
  });

  it("allows issuer to revoke a certificate", async function () {
    const { verifier, admin, issuer } = await deployFixture();
    const ISSUER_ROLE = await verifier.ISSUER_ROLE();
    await verifier.connect(admin).grantRole(ISSUER_ROLE, issuer.address);

    const hash = keccak256(toUtf8Bytes("certificate-3"));
    await verifier.connect(issuer).issue(hash, 0);
    await verifier.connect(issuer).revoke(hash);

    const result = await verifier.verify(hash);
    expect(result[1]).to.equal(true);
  });

  it("verify() on a nonexistent hash returns exists = false", async function () {
    const { verifier } = await deployFixture();
    const hash = keccak256(toUtf8Bytes("never-issued"));
    const result = await verifier.verify(hash);
    expect(result[0]).to.equal(false);
  });
});