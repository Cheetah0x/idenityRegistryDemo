# Identity Registry Demo

Demo for Lucas and Rahul

## Setup and Compilation

```bash
cd identityRegistry && aztec-nargo compile
```

## Current Error

When the `verify_proof_with_type` is not commented out, I get this error:

```bash
bb: /home/aztec-dev/aztec-packages/barretenberg/cpp/src/barretenberg/dsl/acir_format/honk_recursion_constraint.cpp:49: void acir_format::(anonymous namespace)::create_dummy_vkey_and_proof(typename Flavor::CircuitBuilder &, size_t, size_t, const std::vector<field_ct<typename Flavor::CircuitBuilder>> &, const std::vector<field_ct<typename Flavor::CircuitBuilder>> &) [Flavor = bb::UltraRecursiveFlavor_<bb::MegaCircuitBuilder_<bb::field<bb::Bn254FrParams>>>]: Assertion `(proof_size == NativeFlavor::PROOF_LENGTH_WITHOUT_PUB_INPUTS)' failed. 
```