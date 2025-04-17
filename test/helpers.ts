import { AccountWallet, Fr, PXE, SentTx, TxReceipt } from "@aztec/aztec.js"
import { GasSettings } from "@aztec/stdlib/gas"
import { getSponsoredFeePaymentMethod } from "./fee/sponsored_feepayment_method.js"

export const sendEmptyTx = async (wallet: AccountWallet, pxe: PXE): Promise<TxReceipt> => {
  console.log("sendEmptyTx...")

  const paymentMethod = await getSponsoredFeePaymentMethod(pxe)
  const txRequest = await wallet.createTxExecutionRequest(
    {
      calls: [],
      authWitnesses: [],
      capsules: [],
      extraHashedArgs: [],
    },
    {
      paymentMethod,
      gasSettings: GasSettings.default({
        maxFeesPerGas: await wallet.getCurrentBaseFees(),
      }),
    },
    {
      nonce: Fr.random(),
    },
  )

  const simulatedTx = await wallet.simulateTx(
    txRequest,
    true, // simulatePublic
  )

  const provenTx = await wallet.proveTx(txRequest, simulatedTx.privateExecutionResult)
  return await new SentTx(wallet, wallet.sendTx(provenTx.toTx())).getReceipt()
}

export const sendEmptyTxs = async (wallet: AccountWallet, pxe: PXE, count: number) => {
  for (let i = 0; i < count; i++) {
    const currentBlock = await pxe.getBlockNumber()
    await sendEmptyTx(wallet, pxe)

    // Wait for block to increment
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 500)) // Wait 0.5 seconds
      const newBlock = await pxe.getBlockNumber()
      if (newBlock > currentBlock) {
        break
      }
    }
  }
}
