import { getDeployedTestAccountsWallets } from "@aztec/accounts/testing"
import { AccountWalletWithSecretKey, AztecAddress, createPXEClient, deriveKeys, Fr, PXE, SendMethodOptions } from "@aztec/aztec.js"
import { beforeAll, describe, expect, it } from "vitest"
import { getContractProofDataFromFixture, getProofsFromFixture, getVkeysFromFixture } from "../fixtures/zkPassport/zkPassportFixtures"
import { IdentityRegistryService } from "../../src/identity/identityRegistryService"
import { sendEmptyTxs } from "../../src/kernel/utils"
import { getSponsoredFeePaymentMethod, SponsoredFeePaymentMethod } from "../../src/fee/sponsored_feepayment_method"

describe("ZkPassportHelper with IdentityRegistryService", () => {
  let pxe: PXE
  let identityRegistryAddress: AztecAddress
  let user: AccountWalletWithSecretKey
  let admin: AccountWalletWithSecretKey
  let identityRegistryService: IdentityRegistryService
  let passportId: bigint
  let paymentMethod: SponsoredFeePaymentMethod


  const SANDBOX_URL = "http://localhost:8080"
  const NETWORK_ID = "localhost"

  beforeAll(async () => {
    pxe = await createPXEClient(SANDBOX_URL)
    user = (await getDeployedTestAccountsWallets(pxe))[1]
    admin = (await getDeployedTestAccountsWallets(pxe))[0]
    paymentMethod = await getSponsoredFeePaymentMethod(pxe)
  })

  it("should deploy the identity registry contract", async () => {
    // Create the IdentityRegistryService
    identityRegistryService = new IdentityRegistryService(
      admin,
    )

    // Deploy the identity registry contract
    const deployed = await identityRegistryService.deployIdentityRegistry()
    identityRegistryAddress = deployed.address

    expect(identityRegistryAddress).toBeDefined()
    console.log("Deployed identity registry at:", identityRegistryAddress.toString())
  })

  it("should format proofs for contract using fixture data", async () => {
    // Get the fixture proof data directly
    const { proofs, public_inputs, scopedNullifier } = await getProofsFromFixture()
    const vkeys = await getVkeysFromFixture()
    
    // Manually create a ContractProofData object
    const contractProofData = {
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
    
    // Verify the structure
    expect(contractProofData).toBeDefined()
    
    // Check that vkeys are structured correctly
    expect(contractProofData.vkeys.vkey_a).toBeDefined()
    expect(contractProofData.vkeys.vkey_b).toBeDefined()
    expect(contractProofData.vkeys.vkey_c).toBeDefined()
    expect(contractProofData.vkeys.vkey_d).toBeDefined()
    expect(contractProofData.vkeys.vkey_a.length).toBe(128) // Expected size
    
    // Check that proofs are structured correctly
    expect(contractProofData.proofs.proof_a).toBeDefined()
    expect(contractProofData.proofs.proof_b).toBeDefined()
    expect(contractProofData.proofs.proof_c).toBeDefined()
    expect(contractProofData.proofs.proof_d).toBeDefined()
    expect(contractProofData.proofs.proof_a.length).toBe(459) // Expected size
    
    // Check that public inputs are structured correctly
    expect(contractProofData.public_inputs.input_a).toBeDefined()
    expect(contractProofData.public_inputs.input_b).toBeDefined()
    expect(contractProofData.public_inputs.input_c).toBeDefined()
    expect(contractProofData.public_inputs.input_d).toBeDefined()
    expect(contractProofData.public_inputs.input_a.length).toBe(2) // Expected size
    
    // Extract zkID using index directly (since we don't have a helper method)
    const zkID = contractProofData.public_inputs.input_d[1]
    passportId = zkID
    
    expect(zkID).toBeDefined()
    console.log("Extracted zkID:", zkID.toString())
    console.log("Passport ID in hex:", "0x" + zkID.toString(16))
    
    // Verify that passportId matches scopedNullifier
    expect(passportId).toEqual(scopedNullifier)
    
    // Verify the proof chain relationship
    console.log("Verifying proof chain relationship:")
    console.log("1. input_a[1] == input_b[0]:", 
      contractProofData.public_inputs.input_a[1] === contractProofData.public_inputs.input_b[0])
    console.log("2. input_b[1] == input_c[0]:", 
      contractProofData.public_inputs.input_b[1] === contractProofData.public_inputs.input_c[0])
    console.log("3. input_c[1] == input_d[0]:", 
      contractProofData.public_inputs.input_c[1] === contractProofData.public_inputs.input_d[0])
    console.log("4. input_d[1] == zkID:", 
      contractProofData.public_inputs.input_d[1] === zkID)
  })

  it("should get formatted proof data using helper function", async () => {
    // Use helper function to get formatted proof data
    const contractProofData = await getContractProofDataFromFixture()
    
    expect(contractProofData).toBeDefined()
    
    // Extract zkID directly
    const zkID = contractProofData.public_inputs.input_d[1]
    
    expect(zkID).toBeDefined()
    
    // Should match previously extracted zkID
    expect(zkID).toEqual(passportId)
  })

  it("should add a zkID to the registry using IdentityRegistryService", async () => {
    // Get formatted proof data
    const contractProofData = await getContractProofDataFromFixture()
    
    // Simulate standard options for transaction
    const sendOptions: SendMethodOptions = {
      fee: { paymentMethod },
      nonce: Fr.random(),
      cancellable: true,
    }
    
    // Extract the zkID
    const zkID = contractProofData.public_inputs.input_d[1]
    expect(zkID).toBeDefined()
    
    // Add zkID to registry
    const result = await identityRegistryService.add_zkID(
      user,
      contractProofData,
      zkID,
      sendOptions
    )
    
    expect(result).toBeDefined()
    expect(result.txHash).toBeDefined()
    console.log("Added zkID transaction hash:", result.txHash.toString())
    
    // Process some empty transactions to make state changes visible
    await sendEmptyTxs(user, pxe, 4)
    
    // Verify the zkID was added correctly
    const isValid = await identityRegistryService.is_valid_zkID(
      user,
      zkID
    )
    
    expect(isValid).toBe(true)
    console.log("ZkID is valid in the registry:", isValid)
    
    // Verify address mapping
    const address = await identityRegistryService.get_address_from_zkID(
      user,
      zkID
    )
    
    expect(address).toEqual(user.getAddress())
    console.log("Address from zkID matches user address:", address.toString())
    
    // Verify zkID mapping
    const retrievedZkID = await identityRegistryService.get_zkID_from_address(
      user
    )
    
    expect(retrievedZkID).toEqual(zkID)
    console.log("ZkID from address matches expected zkID:", retrievedZkID.toString())
  })

  it("should remove a zkID from the registry using IdentityRegistryService", async () => {
    // Get formatted proof data
    const contractProofData = await getContractProofDataFromFixture()
    
    // Simulate standard options for transaction
    const sendOptions: SendMethodOptions = {
      fee: { paymentMethod },
      nonce: Fr.random(),
      cancellable: true,
    }
    
    // Extract the zkID
    const zkID = contractProofData.public_inputs.input_d[1]
    expect(zkID).toBeDefined()
    
    // First verify the zkID is still in the registry
    const isValidBefore = await identityRegistryService.is_valid_zkID(
      user,
      zkID
    )
    
    expect(isValidBefore).toBe(true)
    console.log("ZkID is valid before removal:", isValidBefore)
    
    // Method 1: Remove using proof and zkID
    const result = await identityRegistryService.remove_zkID_with_proof(
      user,
      contractProofData,
      zkID,
      sendOptions
    )
    
    expect(result).toBeDefined()
    expect(result.txHash).toBeDefined()
    console.log("Removed zkID with proof - transaction hash:", result.txHash.toString())
    
    // Process some empty transactions to make state changes visible
    await sendEmptyTxs(user, pxe, 3)
    
    // Verify the zkID was removed
    const isValidAfter = await identityRegistryService.is_valid_zkID(
      user,
      zkID
    )
    
    expect(isValidAfter).toBe(false)
    console.log("ZkID is valid after removal:", isValidAfter)
  })
}) 