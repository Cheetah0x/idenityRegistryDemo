mod types;

use dep::aztec::macros::aztec;

//This is the identity registry contract.
//has a 1:1 mapping between a zkpassportID and a user address.
//should be able to be linked, unlinked, needs to verfiy the proof in the function

#[aztec]
contract IdentityRegistry {
    use dep::aztec::{
        prelude::{AztecAddress, Map, PublicMutable, SharedMutable},
        macros::{functions::{initializer, internal, private, public, view}, storage::storage},
        protocol_types::{abis::function_selector::FunctionSelector, traits::{Deserialize, Serialize, FromField, ToField}},
    };
    use std::{verify_proof_with_type};
    use crate::types::{SubProofInputs};
    global ZERO_ADDRESS: AztecAddress = AztecAddress::from_field(
        0x0000000000000000000000000000000000000000000000000000000000000000,
    );
    global HONK_IDENTIFIER: u32 = 1;
    global KEY_HASH: Field = 0;

   

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        zkPassportIDtoAddress: Map<Field, PublicMutable<AztecAddress, Context>, Context>,
        addressToZKPassportID: Map<AztecAddress, PublicMutable<Field, Context>, Context>,
    }

    #[public]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        storage.admin.write(admin);
    }

    #[public]
    #[view]
    fn is_valid_zkID(zkID: Field) -> bool {
        let mut truth = false;
        let address = storage.zkPassportIDtoAddress.at(zkID).read();
        if address != ZERO_ADDRESS {
            truth = true;
        }
        truth
    }
    

    #[public]
    #[view]
    fn is_valid_address(address: AztecAddress) -> bool {
        let mut truth = false;
        let zkID = storage.addressToZKPassportID.at(address).read();
        if zkID != 0 {
            truth = true;
        }
        truth
    }

    #[public]
    #[view]
    fn get_address_from_zkID(zkID: Field) -> AztecAddress {
        storage.zkPassportIDtoAddress.at(zkID).read()
    }

    #[public]
    #[view]
    fn get_zkID_from_address(address: AztecAddress) -> Field {
        storage.addressToZKPassportID.at(address).read()
    }

    #[private]
    fn verify_zkID(
        circuitInputs: SubProofInputs,
        zk_id: Field,
        add_zkID: bool,
        remove_zkID: bool,
    ) {
        assert(circuitInputs.public_inputs.input_a[1] == circuitInputs.public_inputs.input_b[0], "comm_out of proof_a does not match comm_in of proof_b");
        assert(circuitInputs.public_inputs.input_b[1] == circuitInputs.public_inputs.input_c[0], "comm_out of proof_c does not match comm_in of proof_d");
        // assert(circuitInputs.public_inputs.input_c[1] == circuitInputs.public_inputs.input_d[0], "comm_out of proof_d does not match comm_in of proof_c");
        assert(circuitInputs.public_inputs.input_d[1] == zk_id, "scoped nullifier of proof_d does not match zk_id");
        // Verify all proofs
        verify_proof_with_type(
            circuitInputs.vkeys.vkey_a,
            circuitInputs.proofs.proof_a,
            circuitInputs.public_inputs.input_a,
            KEY_HASH,
            HONK_IDENTIFIER,
        );

        // verify_proof_with_type(
        //     circuitInputs.vkeys.vkey_b,
        //     circuitInputs.proofs.proof_b,
        //     circuitInputs.public_inputs.input_b,
        //     KEY_HASH,
        //     HONK_IDENTIFIER,
        // );
        // verify_proof_with_type(
        //     circuitInputs.vkeys.vkey_c,
        //     circuitInputs.proofs.proof_c,
        //     circuitInputs.public_inputs.input_c,
        //     KEY_HASH,
        //     HONK_IDENTIFIER,
        // );
        // verify_proof_with_type(
        //     circuitInputs.vkeys.vkey_d,
        //     circuitInputs.proofs.proof_d,
        //     circuitInputs.public_inputs.input_d,
        //     KEY_HASH,
        //     HONK_IDENTIFIER,
        // );
        
        // Add the zkID to storage
        let address = context.msg_sender();

        if remove_zkID & !add_zkID {
            IdentityRegistry::at(context.this_address())._remove_zkID(zk_id, address).enqueue(&mut context);
        }
        else {
            IdentityRegistry::at(context.this_address())._add_zkID(zk_id, address).enqueue(&mut context);
        }
    }


    #[public]
    #[internal]
    fn _add_zkID(zk_id: Field, address: AztecAddress) {
        storage.zkPassportIDtoAddress.at(zk_id).write(address);
        storage.addressToZKPassportID.at(address).write(zk_id);
    }

    #[public]
    #[internal]
    fn _remove_zkID(zk_id: Field, address: AztecAddress) {
        storage.zkPassportIDtoAddress.at(zk_id).write(ZERO_ADDRESS);
        storage.addressToZKPassportID.at(address).write(0);
    }

    #[public]
    fn remove_zkID_with_address() {
        let address = context.msg_sender();
        let passport_id = storage.addressToZKPassportID.at(address).read();
        if passport_id != 0 {
            storage.zkPassportIDtoAddress.at(passport_id).write(ZERO_ADDRESS);
            storage.addressToZKPassportID.at(address).write(0);
        }
        else {
            assert(false, "No zkID found for address");
        }
    }

}

