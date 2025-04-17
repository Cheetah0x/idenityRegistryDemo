import { ContractProofData } from "./identityRegistryService.js"
// @ts-ignore - The @zkpassport/utils package lacks proper TypeScript declarations
import { type ProofResult, getHostedPackagedCircuitByName, getProofData, getCommitmentFromDSCProof, getMerkleRootFromDSCProof, getCommitmentInFromIDDataProof, getCommitmentOutFromIDDataProof, getNullifierFromDisclosureProof, getCommitmentInFromIntegrityProof, getCommitmentOutFromIntegrityProof, getCommitmentInFromDisclosureProof, ultraVkToFields, proofToFields } from "@zkpassport/utils"



/**
 * ZKPassportHelper class provides methods for working with zkPassport proofs
 * and preparing them for use with Aztec contracts.
 */
export class ZKPassportHelper {
  // Add a constant for the proof size
  private static readonly PROOF_SIZE = 459; // Match the contract's PROOF_SIZE constant

  /**
   * Get verification key for a circuit using name and hash
   * @param proofResult - The proof result containing circuit information
   * @returns Promise resolving to an array of bigints representing the verification key
   */
  public static async getCircuitVerificationKey(proofResult: ProofResult): Promise<bigint[]> {
    try {
      if (!proofResult.name || !proofResult.vkeyHash || !proofResult.version) {
        throw new Error("Missing required proof information (name, vkeyHash, or version)")
      }
      console.log("proofResult:", proofResult)

      // Fetch the packaged circuit data using vkeyHash
      console.log("Fetching packaged circuit with vkeyHash:", proofResult.vkeyHash)
      try {
        console.log("version:", proofResult.version)
        console.log("name:", proofResult.name)
        const fallbackCircuit = await getHostedPackagedCircuitByName(
          proofResult.version,
          proofResult.name,
        )
        console.log("Fallback circuit:", fallbackCircuit)
        console.log("Packaged circuit:", fallbackCircuit ? "Found" : "Not found")

        if (fallbackCircuit && fallbackCircuit.vkey) {
          const vkeyUint8Array = this.base64ToUint8Array(fallbackCircuit.vkey)
          const vkeyFieldsString = ultraVkToFields(vkeyUint8Array)

          const vkeyFields = vkeyFieldsString.map((f: string) => BigInt(f.startsWith('0x') ? f : '0x' + f))
          const vkeyFieldsBigInt = this.ensureSize(vkeyFields, 128)

          return vkeyFieldsBigInt
        }
      } catch (fallbackError) {
        console.error("Error fetching circuit by name:", fallbackError)
      }

      // If we get here, both methods failed
      console.error(`Unable to fetch verification key for circuit: ${proofResult.name}`)
      // Return a placeholder array of 128 elements
      console.warn("Using fallback empty array for verification key")
      return Array(128).fill(BigInt(0))
    } catch (error) {
      console.error("Error in getCircuitVerificationKey:", error)
      if (error instanceof Error) {
        console.error("Error message:", error.message)
        console.error("Error stack:", error.stack)
      }
      // Return a placeholder array of 128 elements
      console.warn("Using fallback empty array for verification key")
      return Array(128).fill(BigInt(0))
    }
  }

  /**
   * Helper function to format proof data for Noir contract
   * @param proofData - The proof data to format
   * @returns An array of bigints representing the formatted proof data
   */
  public static formatProofData(proofData: any): bigint[] {
    const fields = proofToFields(proofData.proof)
    console.log("Fields:", fields)

    const bigIntFields = fields.map((f: string) => BigInt(f.startsWith('0x') ? f : '0x' + f))
    const bigIntFieldsBigInt = this.ensureSize(bigIntFields, this.PROOF_SIZE)
    return bigIntFieldsBigInt
  }

  /**
   * Unified function to format circuit proof data structures
   * @param proofResult - The proof result to format
   * @param circuitType - The type of circuit (A, B, C, or D)
   * @returns Promise resolving to an object containing vkey, proof, and public_inputs
   */
  public static async formatSubCircuit(
    proofResult: ProofResult,
    circuitType: "A" | "B" | "C" | "D",
  ): Promise<{
    vkey: bigint[];
    proof: bigint[];
    public_inputs: bigint[];
  }> {
    try {
      console.log(`Formatting SubCircuit${circuitType} for proof:`, proofResult.name)

      // Get the proof data
      let proofData: any
      try {
        console.log("Getting proof data from:", typeof proofResult.proof)
        proofData = getProofData(proofResult.proof as string, 2)
        console.log("Proof data:", proofData)
      } catch (proofError) {
        console.error("Error getting proof data:", proofError)
      }

      // Get verification key using name and hash
      let vkey: bigint[]
      try {
        // Get the verification key directly as BigInt array
        vkey = await this.getCircuitVerificationKey(proofResult)
        console.log("Got vkey array:", vkey.length, "elements")
      } catch (vkeyError) {
        console.error(`Error getting verification key for SubCircuit${circuitType}:`, vkeyError)
        vkey = Array(128).fill(BigInt(0))
      }

      // Format the proof data
      let formattedProofData: bigint[]
      try {
        formattedProofData = this.formatProofData(proofData)
      } catch (formatError) {
        console.error("Error formatting proof data:", formatError)
        formattedProofData = Array(this.PROOF_SIZE).fill(BigInt(0))
      }

      // Extract public inputs based on circuit type
      let publicInputs: bigint[] = []
      try {
        switch (circuitType) {
          case "A": // DSC proof
            const root = getMerkleRootFromDSCProof(proofData)
            const commitment = getCommitmentFromDSCProof(proofData)
            publicInputs = [root, commitment] 
            console.log("Successfully retrieved commitment: A", 
              "root: ", root.toString(),
              "commitment: ", commitment.toString()
            )
            break

          case "B": // ID Data proof
            const commitmentInB = getCommitmentInFromIDDataProof(proofData)
            const commitmentOutB = getCommitmentOutFromIDDataProof(proofData)
            publicInputs = [commitmentInB, commitmentOutB]
            console.log("Successfully retrieved commitments: B", 
              "in: ", commitmentInB.toString(),
              "out: ", commitmentOutB.toString()
            )
            break

          case "C": // Integrity proof
            const commitmentInC = getCommitmentInFromIntegrityProof(proofData)
            const commitmentOutC = getCommitmentOutFromIntegrityProof(proofData)
            publicInputs = [commitmentInC, commitmentOutC]
            console.log("Successfully retrieved commitments: C", 
              "in: ", commitmentInC.toString(),
              "out: ", commitmentOutC.toString()
            )
            break

          case "D": // Disclosure proof
            const commitmentInD = getCommitmentInFromDisclosureProof(proofData)
            const nullifier = getNullifierFromDisclosureProof(proofData)
            publicInputs = [commitmentInD, nullifier]
            console.log("Successfully retrieved commitment and nullifier: D", 
              "in: ", commitmentInD.toString(),
              "nullifier: ", nullifier.toString()
            )
            break
        }
      } catch (extractionError) {
        console.error(`Error extracting public inputs for SubCircuit${circuitType}:`, extractionError)
        publicInputs = [BigInt(0), BigInt(0)] // Always return 2 elements to match contract
      }

      // Return only the required data: vkey, proof, and public_inputs
      return {
        vkey: vkey,
        proof: formattedProofData,
        public_inputs: publicInputs,
      }
    } catch (error) {
      console.error(`Error in formatSubCircuit${circuitType}:`, error)
      if (error instanceof Error) {
        console.error("Error message:", error.message)
        console.error("Error stack:", error.stack)
      }

      // Return a fallback structure with only the required fields
      return {
        vkey: Array(128).fill(BigInt(0)),
        proof: Array(this.PROOF_SIZE).fill(BigInt(0)),
        public_inputs: [BigInt(0), BigInt(0)], // Always return 2 elements to match contract
      }
    }
  }

  /**
   * Format SubCircuit A (DSC proof)
   * @param proofResult - The proof result to format
   * @returns Promise resolving to formatted circuit data
   */
  public static async formatSubCircuitA(proofResult: ProofResult): Promise<any> {
    return this.formatSubCircuit(proofResult, "A")
  }

  /**
   * Format SubCircuit B (ID Data proof)
   * @param proofResult - The proof result to format
   * @returns Promise resolving to formatted circuit data
   */
  public static async formatSubCircuitB(proofResult: ProofResult): Promise<any> {
    return this.formatSubCircuit(proofResult, "B")
  }

  /**
   * Format SubCircuit C (Integrity proof)
   * @param proofResult - The proof result to format
   * @returns Promise resolving to formatted circuit data
   */
  public static async formatSubCircuitC(proofResult: ProofResult): Promise<any> {
    return this.formatSubCircuit(proofResult, "C")
  }

  /**
   * Format SubCircuit D (Disclosure proof)
   * @param proofResult - The proof result to format
   * @returns Promise resolving to formatted circuit data
   */
  public static async formatSubCircuitD(proofResult: ProofResult): Promise<any> {
    return this.formatSubCircuit(proofResult, "D")
  }

  /**
   * Format all proofs for the smart contract
   * @param proofs - Array of proof results to format
   * @returns Promise resolving to contract proof data or undefined if an error occurs
   */
  public static async formatProofsForContract(proofs: ProofResult[]): Promise<ContractProofData | undefined> {
    try {
      console.log("Starting formatProofsForContract with proofs:", proofs)
      
      // Define the expected proof keywords and their order
      const proofKeywords = {
        A: "dsc",        // Document Signer Certificate check 
        B: "id_data",    // ID Data check
        C: "integrity",  // Integrity check
        D: "disclose"    // Disclosure check
      };
      
      // The expected order of proofs in the verification process
      const expectedProofOrder = [
        proofKeywords.A,
        proofKeywords.B,
        proofKeywords.C,
        proofKeywords.D
      ];
      
      // Check if we have all required proofs (4 total)
      if (proofs.length !== 4) {
        console.error(`Incorrect number of proofs: expected 4, got ${proofs.length}`);
        console.error("Expected proof order:", expectedProofOrder.join(" → "));
        console.error("Missing proofs will prevent successful verification");
      }
      
      // Check if proofs are in the expected order by looking for keywords in names
      const detectedOrder = proofs.map(proof => {
        if (!proof.name) return "unknown";
        const name = proof.name.toLowerCase();
        if (name.includes(proofKeywords.A)) return proofKeywords.A;
        if (name.includes(proofKeywords.B)) return proofKeywords.B;
        if (name.includes(proofKeywords.C)) return proofKeywords.C;
        if (name.includes(proofKeywords.D)) return proofKeywords.D;
        return "unknown";
      });
      
      // Validate proof order
      let isCorrectOrder = true;
      for (let i = 0; i < Math.min(detectedOrder.length, expectedProofOrder.length); i++) {
        if (detectedOrder[i] !== expectedProofOrder[i]) {
          isCorrectOrder = false;
          console.error(`Incorrect proof at position ${i}: expected ${expectedProofOrder[i]}, got ${detectedOrder[i]}`);
        }
      }
      
      if (!isCorrectOrder) {
        console.error("Proofs are not in the correct order. This may lead to verification failure.");
        console.error("The proofs must follow this order:", expectedProofOrder.join(" → "));
      } else {
        console.log("✓ Proofs are in the correct order");
      }
      
      // Mapping of expected circuit names to positions
      const circuitMap = {
        "dsc_check": 0, // Circuit A
        "id_attribute_check": 1, // Circuit B
        "integrity_check_sha256": 2, // Circuit C
        "disclosure_check": 3 // Circuit D
      };
      
      console.log("Found proofs:", {
        dscProof: proofs[0]?.name,
        idDataProof: proofs[1]?.name,
        integrityProof: proofs[2]?.name,
        disclosureProof: proofs[3]?.name,
      });
      
      // Find the proofs by keyword rather than position
      
      const proofA = proofs.find(p => p.name?.toLowerCase().includes(proofKeywords.A));
      const proofB = proofs.find(p => p.name?.toLowerCase().includes(proofKeywords.B));
      const proofC = proofs.find(p => p.name?.toLowerCase().includes(proofKeywords.C));
      const proofD = proofs.find(p => p.name?.toLowerCase().includes(proofKeywords.D));
      
      // Check if all required proofs were found
      if (!proofA || !proofB || !proofC || !proofD) {
        console.error("Missing required proofs:");
        if (!proofA) console.error("- Missing DSC proof (Circuit A)");
        if (!proofB) console.error("- Missing ID Data proof (Circuit B)");
        if (!proofC) console.error("- Missing Integrity proof (Circuit C)");
        if (!proofD) console.error("- Missing Disclosure proof (Circuit D)");
        return undefined;
      }
      
      // Format the proofs
      console.log("Formatting proofs in correct order...");
      console.log("Formatting proof A (DSC):", proofA.name);
      const formattedProofA = await this.formatSubCircuitA(proofA);
      
      console.log("Formatting proof B (ID Data):", proofB.name);
      const formattedProofB = await this.formatSubCircuitB(proofB);
      
      console.log("Formatting proof C (Integrity):", proofC.name);
      const formattedProofC = await this.formatSubCircuitC(proofC);
      
      console.log("Formatting proof D (Disclosure):", proofD.name);
      const formattedProofD = await this.formatSubCircuitD(proofD);
      
      // Extract the scoped nullifier from the last element of proof D's public inputs
      const scopedNullifier = formattedProofD.public_inputs[1];
      console.log("Scoped nullifier (zkID):", scopedNullifier.toString());
      
      // Use the original public inputs without reordering
      const originalPublicInputs = {
        input_a: formattedProofA.public_inputs,
        input_b: formattedProofB.public_inputs,
        input_c: formattedProofC.public_inputs,
        input_d: formattedProofD.public_inputs
      };
      
      // Log the original public inputs
      console.log("Original public inputs:", {
        input_a: originalPublicInputs.input_a.map((n: bigint) => "0x" + n.toString(16)),
        input_b: originalPublicInputs.input_b.map((n: bigint) => "0x" + n.toString(16)),
        input_c: originalPublicInputs.input_c.map((n: bigint) => "0x" + n.toString(16)),
        input_d: originalPublicInputs.input_d.map((n: bigint) => "0x" + n.toString(16))
      });
      
      // Verify proof chain connections
      console.log("Verifying proof chain integrity...");
      
      // Check all connections in the proof chain
      const chainConnections = [
        // A output -> B input
        originalPublicInputs.input_a[1] === originalPublicInputs.input_b[0],
        // B output -> C input
        originalPublicInputs.input_b[1] === originalPublicInputs.input_c[0],
        // C output -> D input
        originalPublicInputs.input_c[1] === originalPublicInputs.input_d[0],
        // D output = nullifier
        originalPublicInputs.input_d[1] === scopedNullifier
      ];
      
      // Log chain integrity checks
      console.log("1. A→B connection:", chainConnections[0] ? "✓" : "✗", 
                 "A output:", originalPublicInputs.input_a[1].toString(),
                 "B input:", originalPublicInputs.input_b[0].toString());
                 
      console.log("2. B→C connection:", chainConnections[1] ? "✓" : "✗", 
                 "B output:", originalPublicInputs.input_b[1].toString(),
                 "C input:", originalPublicInputs.input_c[0].toString());
                 
      console.log("3. C→D connection:", chainConnections[2] ? "✓" : "✗", 
                 "C output:", originalPublicInputs.input_c[1].toString(),
                 "D input:", originalPublicInputs.input_d[0].toString());
                 
      console.log("4. D→ZkID match:", chainConnections[3] ? "✓" : "✗", 
                 "D output:", originalPublicInputs.input_d[1].toString(),
                 "ZkID:", scopedNullifier.toString());
      
      const isChainValid = chainConnections.every(check => check);
      
      if (isChainValid) {
        console.log("✓ Proof chain integrity verified successfully");
      } else {
        console.error("✗ Proof chain integrity verification failed");
        console.error("The proof chain must connect properly from A→B→C→D");
      }
      
      // Structure the data to match the Noir contract
      console.log("Returning formatted proof data with original public inputs")
      return {
        vkeys: {
          vkey_a: formattedProofA.vkey,
          vkey_b: formattedProofB.vkey,
          vkey_c: formattedProofC.vkey,
          vkey_d: formattedProofD.vkey,
        },
        proofs: {
          proof_a: formattedProofA.proof,
          proof_b: formattedProofB.proof,
          proof_c: formattedProofC.proof,
          proof_d: formattedProofD.proof,
        },
        public_inputs: originalPublicInputs
      }
    } catch (error) {
      console.error("Error in formatProofsForContract:", error)
      if (error instanceof Error) {
        console.error("Error message:", error.message)
        console.error("Error stack:", error.stack)
      }

      // Return a fallback structure with default values
      console.warn("Using fallback values for contract proof data")
      return undefined
    }
  }
  
  /**
   * Convert base64 string to Uint8Array
   * @param base64 - The base64 string to convert
   * @returns Uint8Array representation of the base64 string
   */
  public static base64ToUint8Array(base64: string): Uint8Array {
    const buffer = Buffer.from(base64, 'base64');
    return new Uint8Array(buffer);
  }

  /**
   * Ensure an array has the expected size by padding or truncating
   * @param arr - The array to resize
   * @param expectedSize - The expected size of the array
   * @returns Resized array with the expected size
   */
  public static ensureSize(arr: bigint[], expectedSize: number): bigint[] {
    if (arr.length === expectedSize) {
      return arr;
    }
    
    if (arr.length < expectedSize) {
      console.log(`Padding vkey from ${arr.length} to ${expectedSize} elements`);
      return [...arr, ...Array(expectedSize - arr.length).fill(BigInt(0))];
    } else {
      console.log(`Truncating vkey from ${arr.length} to ${expectedSize} elements`);
      return arr.slice(0, expectedSize);
    }
  }

  /**
   * Extract zkID (nullifier) from formatted proof data
   * @param contractProofData - The formatted contract proof data
   * @returns The zkID as a bigint, or undefined if not found
   */
  public static extractZkID(contractProofData: ContractProofData): bigint | undefined {
    try {
      // The zkID is the nullifier in the disclosure proof (circuit D)
      if (contractProofData?.public_inputs?.input_d?.[1]) {
        return contractProofData.public_inputs.input_d[1];
      }
      return undefined;
    } catch (error) {
      console.error("Error extracting zkID:", error);
      return undefined;
    }
  }
}

// Export the class and individual functions for backward compatibility
export {
  getCircuitVerificationKey,
  formatProofData,
  formatSubCircuitA,
  formatSubCircuitB,
  formatSubCircuitC,
  formatSubCircuitD,
  formatProofsForContract,
  base64ToUint8Array,
}


async function getCircuitVerificationKey(proofResult: ProofResult): Promise<bigint[]> {
  return ZKPassportHelper.getCircuitVerificationKey(proofResult);
}

function formatProofData(proofData: any): bigint[] {
  return ZKPassportHelper.formatProofData(proofData);
}

async function formatSubCircuitA(proofResult: ProofResult): Promise<any> {
  return ZKPassportHelper.formatSubCircuitA(proofResult);
}

async function formatSubCircuitB(proofResult: ProofResult): Promise<any> {
  return ZKPassportHelper.formatSubCircuitB(proofResult);
}

async function formatSubCircuitC(proofResult: ProofResult): Promise<any> {
  return ZKPassportHelper.formatSubCircuitC(proofResult);
}

async function formatSubCircuitD(proofResult: ProofResult): Promise<any> {
  return ZKPassportHelper.formatSubCircuitD(proofResult);
}

async function formatProofsForContract(proofs: ProofResult[]): Promise<ContractProofData | undefined> {
  return ZKPassportHelper.formatProofsForContract(proofs);
}

function base64ToUint8Array(base64: string): Uint8Array {
  return ZKPassportHelper.base64ToUint8Array(base64);
}
