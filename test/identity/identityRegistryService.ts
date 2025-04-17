
import { AccountWallet, AztecAddress, deriveKeys, Fr, SendMethodOptions } from "@aztec/aztec.js"
import { IdentityRegistryContract } from "../../artifacts/IdentityRegistry.js"
import { GasSettings } from "@aztec/stdlib/gas";
export interface ContractProofData {
  vkeys: {
    vkey_a: bigint[];
    vkey_b: bigint[];
    vkey_c: bigint[];
    vkey_d: bigint[];
  };
  proofs: {
      proof_a: bigint[];
      proof_b: bigint[];
      proof_c: bigint[];
      proof_d: bigint[];
  };
  public_inputs: {
      input_a: bigint[];
      input_b: bigint[];
      input_c: bigint[];
      input_d: bigint[];
    };
}

export class IdentityRegistryService {

  private admin: AccountWallet
  private identityRegistryAddress: AztecAddress | undefined

  constructor(
    admin: AccountWallet,
    identityRegistryAddress?: AztecAddress,
  ) {
    this.admin = admin
    this.identityRegistryAddress = identityRegistryAddress
  }

  public async getIdentityRegistry(): Promise<IdentityRegistryContract> {
    if (!this.identityRegistryAddress) {
      throw new Error("Identity registry address not found")
    }
    return await IdentityRegistryContract.at(this.identityRegistryAddress, this.admin)
  }

  public async deployIdentityRegistry() : Promise<IdentityRegistryContract> {
    try {
      const identityRegistrySecretKey = Fr.random()
      const identityRegistryPublicKeys = (await deriveKeys(identityRegistrySecretKey)).publicKeys

    const contract = IdentityRegistryContract.deployWithPublicKeys(
      identityRegistryPublicKeys,
      this.admin,
      this.admin.getAddress(),
    )

    const deployed = await contract.send().deployed()
    this.identityRegistryAddress = deployed.address
    return deployed
    } catch (error) {
      console.error("Error deploying identity registry:", error)
      throw error
    }
  }

  public async checkOtherUserZkID(
    account: AccountWallet,
    address: AztecAddress,
  ): Promise<boolean> {
    const identityRegistry = await this.getIdentityRegistry();

    //this will be used to check if other users have a valid zkID, can add this to the address book. confirm them as verified.

    const isValid = await identityRegistry
    .withWallet(account)
    .methods.is_valid_address(address)
    .simulate()

    return isValid
    
  }

  public async checkExistingzkID(
    account: AccountWallet,
  ): Promise<boolean> {
    try {
      const identityRegistry = await this.getIdentityRegistry();
      
      const isValid = await identityRegistry
        .withWallet(account)
        .methods.is_valid_address(account.getAddress())
        .simulate()
      console.log("Contract zkID validity check:", isValid)
      
      return isValid
    } catch (error) {
      console.error("Error checking if zkID is valid:", error)
      throw error
    }
  }

  public async add_zkID(
    account: AccountWallet,
    contractProofData: ContractProofData,
    zk_id: bigint,
    options?: SendMethodOptions,
  ){
    //this is going to have to call the helper functions in the helpers
    const identityRegistry = await this.getIdentityRegistry();

    try {
      console.log("Adding user to identity registry...")

      const sendOptions: SendMethodOptions = options ?? await this.sendOptionsAdmin()

      //will have to check, but i think that the fee payment is sorted. 
      //TODO: check this
      try {
        const tx = await identityRegistry
        .withWallet(account)
        .methods.verify_zkID(contractProofData, zk_id, true, false)
        .send(sendOptions)

        await tx.wait()
      
        return { txHash: await tx.getTxHash() }
      } catch (error: unknown) {
        if (error instanceof Error && error.message?.includes("authenticator not installed")) {
          throw new Error(
            "This account needs to be set up with authentication before registering an email. Please create a new account first.",
          )
        }
        throw error
      }
    } catch (error) {
      console.error("Error adding zkID to registry:", error)
      throw error
    }
  }

  public async remove_zkID_with_proof(
    account: AccountWallet,
    contractProofData: ContractProofData,
    zk_id: bigint,
    options?: SendMethodOptions,
  ){
    const identityRegistry = await this.getIdentityRegistry();

    try {
      console.log("Removing user from identity registry...")

      const sendOptions: SendMethodOptions = options ?? await this.sendOptionsAdmin()

      const tx = await identityRegistry
      .withWallet(account)
      .methods.verify_zkID(contractProofData, zk_id, false, true)
      .send(sendOptions)

      await tx.wait()

      return { txHash: await tx.getTxHash() }
    } catch (error) {
      console.error("Error removing zkID from registry:", error)
      throw error
    }
  }

  public async remove_zkID_with_address(
    account: AccountWallet,
    options?: SendMethodOptions,
  ){
    const identityRegistry = await this.getIdentityRegistry();

    try {
      console.log("Removing user from identity registry...")

      const sendOptions: SendMethodOptions = options ?? await this.sendOptionsAdmin()

      const tx = await identityRegistry
      .withWallet(account)
      .methods.remove_zkID_with_address()
      .send(sendOptions)
      
      await tx.wait()

      return { txHash: await tx.getTxHash() }
    } catch (error) {
      console.error("Error removing zkID from registry:", error)
      throw error
    }
  }

  public async is_valid_zkID(
    account: AccountWallet,
    zk_id: bigint,
  ): Promise<boolean> {
    const identityRegistry = await this.getIdentityRegistry();
    try {

      //turn zkid from string to 0x bigint
      const zkID = Fr.fromString(zk_id.toString())

      const isValid = await identityRegistry
      .withWallet(account)
      .methods.is_valid_zkID(zkID)
      .simulate()
      console.log("isValid: ", isValid)
      
      return isValid
    } catch (error) {
      console.error("Error checking if zkID is valid:", error)
      throw error
    }
  }

  public async get_address_from_zkID(
    account: AccountWallet,
    zk_id: bigint,
  ): Promise<AztecAddress> {
    const identityRegistry = await this.getIdentityRegistry();

    try {
      const zkID = await identityRegistry
      .withWallet(account)
      .methods.get_address_from_zkID(zk_id)
      .simulate()
      console.log("address: ", zkID)
      return zkID
    } catch (error) {
      console.error("Error getting address from zkID:", error)
      throw error
    }
  }

  public async get_zkID_from_address(
    account: AccountWallet,
  ): Promise<bigint> {
    const identityRegistry = await this.getIdentityRegistry();
      
    try {
      const address = account.getAddress()
      const zkID = await identityRegistry
      .withWallet(account)
      .methods.get_zkID_from_address(address)
      .simulate()
      console.log("zkID: ", zkID)
      return zkID
    } catch (error) {
      console.error("Error getting zkID from address:", error)
      throw error
    }
  }

  private async sendOptionsAdmin(options?: SendMethodOptions){
    const sendOptions: SendMethodOptions = options ?? {
      fee: {
        gasSettings: GasSettings.default({
          maxFeesPerGas: await this.admin.getCurrentBaseFees(),
        }),
      },
      nonce: Fr.random(),
      cancellable: true,
    }

    return sendOptions
  }
}