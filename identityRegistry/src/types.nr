use dep::aztec::protocol_types::traits::{Deserialize, Serialize};

global VKEY_SIZE: u32 = 128;
global PROOF_SIZE: u32 = 459;
global PUBLIC_INPUT_SIZE: u32 = 2;

#[derive(Serialize, Deserialize)]
pub struct SubProofInputs {
    vkeys: Vkeys,
    proofs: Proofs,
    public_inputs: PubInputs
}

#[derive(Serialize, Deserialize)]
pub struct Vkeys{
    vkey_a: [Field; VKEY_SIZE],
    vkey_b: [Field; VKEY_SIZE],
    vkey_c: [Field; VKEY_SIZE],
    vkey_d: [Field; VKEY_SIZE],
}

#[derive(Serialize, Deserialize)]
pub struct Proofs{
  proof_a: [Field; PROOF_SIZE],
  proof_b: [Field; PROOF_SIZE],
  proof_c: [Field; PROOF_SIZE],
  proof_d: [Field; PROOF_SIZE],
}

#[derive(Serialize, Deserialize)]
pub struct PubInputs{
  input_a: [Field; PUBLIC_INPUT_SIZE],
  input_b: [Field; PUBLIC_INPUT_SIZE],
  input_c: [Field; PUBLIC_INPUT_SIZE],
  input_d: [Field; PUBLIC_INPUT_SIZE],
}