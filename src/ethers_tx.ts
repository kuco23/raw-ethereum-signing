require('dotenv').config()
import BN from "bn.js"
import * as elliptic from "elliptic"
import { ethers, Contract, JsonRpcProvider, Transaction, Signature } from 'ethers';

const chainId = 16

const ec = new elliptic.ec("secp256k1")

const privateKey = process.env.SIGNER!
const publicKey = ec.keyFromPrivate(privateKey).getPublic(false, "hex").slice(2)
const address = `0x` + ethers.keccak256(`0x`+publicKey).slice(-40)
const checksumedAddress = ethers.getAddress(address)

const abi = [{
  "inputs": [
    {
      "internalType": "address",
      "name": "_target",
      "type": "address"
    },
    {
      "internalType": "uint256",
      "name": "amount",
      "type": "uint256"
    }
  ],
  "name": "mintAmount",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}]

async function main() {
  const provider = new JsonRpcProvider("https://coston-api.flare.network/ext/C/rpc", chainId)
  const contract = new Contract('0xC06496FA0551bf4996fb5Df876cBcC6F1d836460', abi, provider)
  const action = 'mintAmount'
  const params = [checksumedAddress, 10]
  const method = contract.getFunction(action)
  const baseTx = await method.populateTransaction(...params)
  const nonce = await provider.getTransactionCount(checksumedAddress)

  // create unsigned transaction
  const tx = Transaction.from({
    ...baseTx,
    nonce: nonce,
    chainId: chainId,
    gasLimit: ethers.toBeHex("10000000"),
    gasPrice: "0x9184e72a000",
  })

  // external transaction signing
  const _signature = ec.sign(
    new BN(tx.unsignedHash.slice(2), 'hex'),
    Buffer.from(privateKey, 'hex'),
    { canonical: true }
  )

  // apply signature to transaction
  tx.signature = Signature.from({
    r: _signature.r.toString(),
    s: _signature.s.toString(),
    yParity: _signature.recoveryParam as 0 | 1
  })

  //await provider.call(tx)
  // send transaction to node
  const txId = await provider.send('eth_sendRawTransaction', [tx.serialized])
  return provider.waitForTransaction(txId)
}

console.log(main())