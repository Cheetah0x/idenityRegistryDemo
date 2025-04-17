//need to add in some fixture data,
//will use my own originally
//can have a test later that includes the helper functions
//that process the data.

import { getDeployedTestAccountsWallets, deployFundedSchnorrAccount } from "@aztec/accounts/testing"
import { AccountWalletWithSecretKey, AztecAddress, createPXEClient, deriveKeys, Fr, PXE } from "@aztec/aztec.js"
import { beforeAll, describe, expect, it } from "vitest"
import { IdentityRegistryContract } from "../artifacts/IdentityRegistry.js"
import * as fs from 'fs'
import * as path from 'path'
import { getProofsFromFixture, getVkeysFromFixture } from "./fixtures/zkPassport/zkPassportFixtures.js"
import { sendEmptyTxs } from "./helpers.js"
//@ts-ignore
import { ultraVkToFields, proofToFields } from "@zkpassport/utils"
import { ZKPassportHelper } from "./identity/ZkPassportHelper.js"
import { getSponsoredFeePaymentMethod, SponsoredFeePaymentMethod } from "./fee/sponsored_feepayment_method.js"


//or maybe can grab from the packaged circuit on the server

describe("ZkPassport Proof Verification", () => {
  let pxe: PXE
  let identityRegistryContract: IdentityRegistryContract
  let identityRegistryAddress: AztecAddress
  let identityRegistryDeployer: AccountWalletWithSecretKey
  let user: AccountWalletWithSecretKey
  let deployer: AccountWalletWithSecretKey
  let userContract: IdentityRegistryContract
  let passportId: bigint
  let proofa: any
  let proofb: any
  let proofc: any
  let proofd: any
  let vkey_a: any
  let vkey_b: any
  let vkey_c: any
  let vkey_d: any
  let public_inputs_a: any
  let public_inputs_b: any
  let public_inputs_c: any
  let public_inputs_d: any
  let paymentMethod: SponsoredFeePaymentMethod


  const SANDBOX_URL = "http://localhost:8080"

  beforeAll(async () => {
    pxe = await createPXEClient(SANDBOX_URL)
    user = (await getDeployedTestAccountsWallets(pxe))[1]
  })

  it("should deploy the contract", async () => {

    const deployer = (await getDeployedTestAccountsWallets(pxe))[0]
    const deployerAddress = deployer.getAddress()
    console.log("deployer address: ", deployerAddress)
    paymentMethod = await getSponsoredFeePaymentMethod(pxe)


    const secretKey = Fr.random()
    const pubKeys = (await deriveKeys(secretKey)).publicKeys

    const contract = IdentityRegistryContract.deployWithPublicKeys(
      pubKeys,
      deployer,
      deployerAddress
    )

    const deployed = await contract.send({ fee: { paymentMethod } }).deployed()
    identityRegistryAddress = deployed.address

    expect(identityRegistryAddress).toBeDefined()
  })

  it("should extract the vkeys from the fixture data", async () => {
    const vkeys = await getVkeysFromFixture()
    console.log("vkeys: ", vkeys)

    expect(vkeys).toBeDefined()
    expect(vkeys.vkey_a).toHaveLength(128)
    expect(vkeys.vkey_b).toHaveLength(128)
    expect(vkeys.vkey_c).toHaveLength(128)
    expect(vkeys.vkey_d).toHaveLength(128)
  })

  it("should correctly parse the verification key structure", async () => {
    // Get the raw vkey data
    const fixtureDir = path.resolve(__dirname, '..', 'fixtures', 'zkPassport')
    const vkeyPath = path.join(fixtureDir, '1_vkey_sig_check_dsc_tbs_700_rsa_pkcs_4096_sha512.json')
    const vkeyData = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'))
    
    // Convert base64 vkey to Uint8Array and process with ultraVkToFields
    const vkeyBytes = ZKPassportHelper.base64ToUint8Array(vkeyData.vkey)
    const vkeyFields = ultraVkToFields(vkeyBytes)
    
    // Convert to BigInt for contract compatibility
    const vkey = vkeyFields.map(f => BigInt(f.startsWith('0x') ? f : '0x' + f))
    
    // Verify the structure
    expect(vkey.length).toBeGreaterThan(0)
    
    // Check that the values are non-zero (a properly parsed key should have meaningful values)
    const nonZeroValues = vkey.filter(val => val !== BigInt(0))
    expect(nonZeroValues.length).toBeGreaterThan(0)
  })

  it("should analyze the structure of the verification key", async () => {
    // Get the raw vkey data
    const fixtureDir = path.resolve(__dirname, '..', 'fixtures', 'zkPassport')
    const vkeyPath = path.join(fixtureDir, '1_vkey_sig_check_dsc_tbs_700_rsa_pkcs_4096_sha512.json')
    const vkeyData = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'))
    
    // Convert base64 vkey to Uint8Array
    const vkeyBytes = ZKPassportHelper.base64ToUint8Array(vkeyData.vkey)
    
    // Process with ultraVkToFields
    const vkeyFields = ultraVkToFields(vkeyBytes)
    
    // Basic verification
    expect(vkeyFields.length).toBeGreaterThan(0)
    console.log(`Verification key contains ${vkeyFields.length} field elements`)
  })

  it("should load and format the proof data correctly using proofToFields", async () => {
    // Get raw proof data for the first proof
    const fixtureDir = path.resolve(__dirname, '..', 'fixtures', 'zkPassport')
    const proofPath = path.join(fixtureDir, '1_sig_check_dsc_tbs_700_rsa_pkcs_4096_sha512_proof.json')
    const proofData = JSON.parse(fs.readFileSync(proofPath, 'utf8'))
    
    // Process directly with proofToFields
    const fields = proofToFields(proofData.proof)
    
    // Basic verification
    expect(fields).toBeDefined()
    expect(fields.length).toBeGreaterThan(0)
    expect(typeof fields[0]).toBe('string')
    
    console.log(`Processed ${fields.length} field elements from proof`)
    
    // Convert to BigInt for further verification
    const bigIntFields = fields.map(f => BigInt(f.startsWith('0x') ? f : '0x' + f))
    
    // Check that fields contain non-zero values
    const nonZeroFields = bigIntFields.filter(val => val !== BigInt(0))
    expect(nonZeroFields.length).toBeGreaterThan(0)
    console.log(`Proof contains ${nonZeroFields.length} non-zero field elements`)
    
    // Verify that these values match what getProofsFromFixture returns
    const { proofs } = await getProofsFromFixture()
    expect(proofs.proof_a.length).toBe(459) // Expected size after padding
    
    // Check the first few elements match (before any potential padding)
    const minLength = Math.min(fields.length, proofs.proof_a.length)
    for (let i = 0; i < minLength; i++) {
      if (i < fields.length) {
        // Compare the BigInt values
        expect(bigIntFields[i]).toEqual(proofs.proof_a[i])
      }
    }
    
    console.log(`Direct and fixture processing methods produce consistent results`)
  })

  it("should load and format the proof data correctly", async () => {
    // Get the proof data
    const { proofs, public_inputs } = await getProofsFromFixture()
    
    // Verify the structure
    expect(proofs.proof_a).toBeDefined()
    expect(proofs.proof_b).toBeDefined()
    expect(proofs.proof_c).toBeDefined()
    expect(proofs.proof_d).toBeDefined()
    
    expect(public_inputs.input_a).toBeDefined()
    expect(public_inputs.input_b).toBeDefined()
    expect(public_inputs.input_c).toBeDefined()
    expect(public_inputs.input_d).toBeDefined()
    
    // Check that the proofs have the expected format (array of BigInts)
    expect(proofs.proof_a.length).toBeGreaterThan(0)
    expect(typeof proofs.proof_a[0]).toBe('bigint')
    
    // Check that the public inputs have the expected format (array of BigInts)
    expect(public_inputs.input_a.length).toBeGreaterThan(0)
    expect(typeof public_inputs.input_a[0]).toBe('bigint')
    
    console.log(`Proof A length: ${proofs.proof_a.length}`)
    console.log(`Proof B length: ${proofs.proof_b.length}`)
    console.log(`Proof C length: ${proofs.proof_c.length}`)
    console.log(`Proof D length: ${proofs.proof_d.length}`)
    
    console.log(`Public inputs A length: ${public_inputs.input_a.length}`)
    console.log(`Public inputs B length: ${public_inputs.input_b.length}`)
    console.log(`Public inputs C length: ${public_inputs.input_c.length}`)
    console.log(`Public inputs D length: ${public_inputs.input_d.length}`)
  })

  it("should ensure proofs match the contract's expected size", async () => {
    // Get the proof data
    const { proofs, public_inputs } = await getProofsFromFixture()

    const EXPECTED_PROOF_SIZE = 459;
    const EXPECTED_PUBLIC_INPUT_SIZE = 2;
    
    // Verify that all proofs have exactly the expected size
    expect(proofs.proof_a.length).toBe(EXPECTED_PROOF_SIZE);
    expect(proofs.proof_b.length).toBe(EXPECTED_PROOF_SIZE);
    expect(proofs.proof_c.length).toBe(EXPECTED_PROOF_SIZE);
    expect(proofs.proof_d.length).toBe(EXPECTED_PROOF_SIZE);
    
    // Verify that all public inputs have exactly the expected size
    expect(public_inputs.input_a.length).toBe(EXPECTED_PUBLIC_INPUT_SIZE);
    expect(public_inputs.input_b.length).toBe(EXPECTED_PUBLIC_INPUT_SIZE);
    expect(public_inputs.input_c.length).toBe(EXPECTED_PUBLIC_INPUT_SIZE);
    expect(public_inputs.input_d.length).toBe(EXPECTED_PUBLIC_INPUT_SIZE);
    
    console.log(`All proofs have the expected size of ${EXPECTED_PROOF_SIZE} elements`);
    console.log(`All public inputs have the expected size of ${EXPECTED_PUBLIC_INPUT_SIZE} elements`);
    
    // Verify that the proofs contain non-zero values (a properly formatted proof should have meaningful values)
    const nonZeroProofA = proofs.proof_a.filter(val => val !== BigInt(0));
    const nonZeroProofB = proofs.proof_b.filter(val => val !== BigInt(0));
    const nonZeroProofC = proofs.proof_c.filter(val => val !== BigInt(0));
    const nonZeroProofD = proofs.proof_d.filter(val => val !== BigInt(0));
    
    expect(nonZeroProofA.length).toBeGreaterThan(0);
    expect(nonZeroProofB.length).toBeGreaterThan(0);
    expect(nonZeroProofC.length).toBeGreaterThan(0);
    expect(nonZeroProofD.length).toBeGreaterThan(0);
    
    console.log(`Proof A has ${nonZeroProofA.length} non-zero elements`);
    console.log(`Proof B has ${nonZeroProofB.length} non-zero elements`);
    console.log(`Proof C has ${nonZeroProofC.length} non-zero elements`);
    console.log(`Proof D has ${nonZeroProofD.length} non-zero elements`);
  })

  it("remove_zkID fails when no zkID is found ", async () => {
   userContract = await IdentityRegistryContract.at(identityRegistryAddress, user)

    await expect(userContract.methods.remove_zkID_with_address().send({ fee: { paymentMethod } }).wait()).rejects.toThrowError(/No zkID found for address/i)
  })

  it("should add a zkPassport ID to the registry", async () => {
    // Get the verification keys and proofs
    const vkeys = await getVkeysFromFixture()
    const { proofs, public_inputs, scopedNullifier } = await getProofsFromFixture()
    
    // Examine the raw proof file C directly
    const fixtureDir = path.resolve(__dirname, '..', 'fixtures', 'zkPassport')
    const proofCPath = path.join(fixtureDir, '3_data_check_integrity_sha256_proof.json')
    const proofCData = JSON.parse(fs.readFileSync(proofCPath, 'utf8'))
    
    console.log("Full raw public inputs for circuit C (integrity check):")
    console.log(proofCData.publicInputs)
    console.log("Raw length:", proofCData.publicInputs.length)
    
    // Examine the raw proof file D directly to get the scoped nullifier
    const proofDPath = path.join(fixtureDir, '4_disclose_some_bytes_proof.json')
    const proofDData = JSON.parse(fs.readFileSync(proofDPath, 'utf8'))
    const dPublicInputs = proofDData.publicInputs
    
    console.log("Full raw public inputs for circuit D (disclose):")
    console.log("Total inputs:", dPublicInputs.length)
    
    if (dPublicInputs.length > 0) {
      const lastElement = dPublicInputs[dPublicInputs.length - 1]
      console.log("Last element of proof D's publicInputs (should be scoped nullifier):", lastElement)
      
      // If there are at least 5 elements, show the last 5
      if (dPublicInputs.length >= 5) {
        console.log("Last 5 elements of D public inputs:")
        for (let i = dPublicInputs.length - 5; i < dPublicInputs.length; i++) {
          console.log(`Index ${i}: ${dPublicInputs[i]}`)
        }
      }
    }
    
    // Create a contract instance
    userContract = await IdentityRegistryContract.at(identityRegistryAddress, user)
    
    // Define the passport ID - use the scoped nullifier from proof D
    // CRITICAL: The zk_id parameter MUST match the second element in public_inputs.input_d
    // According to contract: assert(circuitInputs.public_inputs.input_d[1] == zk_id, "scoped nullifier of proof_d does not match zk_id");
    passportId = public_inputs.input_d[1]; // This must be the scoped nullifier
    console.log("Using public_inputs.input_d[1] as passport ID:", passportId.toString())
    console.log("Passport ID in hex:", "0x" + passportId.toString(16))
    
    // Verify that passportId matches scopedNullifier (should be the same)
    console.log("Do passport ID and scoped nullifier match?", passportId === scopedNullifier);
    
    // Prepare the inputs for the add_zkID method
    const circuitInputs = {
      vkeys: {
        vkey_a: vkeys.vkey_a,
        vkey_b: vkeys.vkey_b,
        vkey_c: vkeys.vkey_c,
        vkey_d: vkeys.vkey_d
      },
      proofs: {
        proof_a: proofs.proof_a,
        proof_b: proofs.proof_b,
        proof_c: proofs.proof_c,
        proof_d: proofs.proof_d
      },
      public_inputs: {
        input_a: public_inputs.input_a,
        input_b: public_inputs.input_b,
        input_c: public_inputs.input_c,
        input_d: public_inputs.input_d
      }
    }
    
    console.log("Calling add_zkID with passport ID:", passportId.toString())
    
    // Print public inputs in hexadecimal format
    console.log("public inputs (hex): ", {
      input_a: public_inputs.input_a.map(v => "0x" + v.toString(16)),
      input_b: public_inputs.input_b.map(v => "0x" + v.toString(16)),
      input_c: public_inputs.input_c.map(v => "0x" + v.toString(16)),
      input_d: public_inputs.input_d.map(v => "0x" + v.toString(16))
    })
    
    // Verify that the contract check will pass:
    // assert(circuitInputs.public_inputs.input_a[1] == circuitInputs.public_inputs.input_b[0])
    // assert(circuitInputs.public_inputs.input_b[1] == circuitInputs.public_inputs.input_c[0])
    // assert(circuitInputs.public_inputs.input_c[1] == circuitInputs.public_inputs.input_d[0])
    // assert(circuitInputs.public_inputs.input_d[1] == zk_id)
    console.log("Contract assertion check 1:", public_inputs.input_a[1] === public_inputs.input_b[0]);
    console.log("Contract assertion check 2:", public_inputs.input_b[1] === public_inputs.input_c[0]);
    console.log("Contract assertion check 3:", public_inputs.input_c[1] === public_inputs.input_d[0]);
    console.log("Contract assertion check 4:", public_inputs.input_d[1] === passportId);
    
    // Call the add_zkID method
    const receipt = await userContract.methods.verify_zkID(circuitInputs, passportId, true, false).send({ fee: { paymentMethod } }).wait()

    await sendEmptyTxs(user, pxe, 0)
    
    // Verify the transaction was successful
    expect(receipt.status).toBe('success')
    
    console.log("Transaction successful:", receipt.txHash.toString())
  })

  it("should verify the zkPassport ID was added to the registry", async () => {
   
    //check that the zkPassport ID was added to the registry
    const zkPassportID = await userContract.methods.is_valid_zkID(passportId).simulate();
    console.log("zkPassportID: ", zkPassportID)
    expect(zkPassportID).toEqual(true)
    
    // Define the passport ID that was added in the previous test 
    const addy = await userContract.methods.get_address_from_zkID(passportId).simulate();
    console.log("addy: ", addy)
    console.log("user address: ", user.getAddress())

    expect(addy).toEqual(user.getAddress())

    const zkID = await userContract.methods.get_zkID_from_address(user.getAddress()).simulate();
    console.log("zkID: ", zkID)
    expect(zkID).toEqual(passportId)
  })

  it("should remove the zkPassport ID from the registry", async () => {
    const receipt = await userContract.methods.remove_zkID_with_address().send({ fee: { paymentMethod } }).wait()

    expect(receipt.status).toBe('success')

    await sendEmptyTxs(user, pxe, 0)

    const addy = await userContract.methods.get_address_from_zkID(passportId).simulate();
    console.log("addy: ", addy)

    const id = await userContract.methods.get_zkID_from_address(user.getAddress()).simulate();
    console.log("id: ", id)

    const zkPassportID = await userContract.methods.is_valid_zkID(passportId).simulate();
    console.log("zkPassportID: ", zkPassportID)

    expect(zkPassportID).toEqual(false)
  })

  it("should fail to check random address", async () => {
    const randomAddress = AztecAddress.fromString("0x2e534437f0ed096274dbb46ce906d424e103bc5f78672f3dfbcf8cccd44d6668")
    const zkPassportID = await userContract.methods.is_valid_address(randomAddress).simulate();
    console.log("zkPassportID: ", zkPassportID)
    expect(zkPassportID).toEqual(false)
  })

  it("should fail to check random zkPassport ID", async () => {
    const randomZkPassportID = Fr.fromString("11114995167492546879752369067573088086089180667191915329873468140916154542171")
    const zkPassportID = await userContract.methods.is_valid_zkID(randomZkPassportID).simulate();
    console.log("zkPassportID: ", zkPassportID)
    expect(zkPassportID).toEqual(false)
  })
})