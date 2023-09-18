require('dotenv').config()
import BN from 'bn.js'
import { ethers, Contract, JsonRpcProvider, Transaction } from 'ethers';
import * as elliptic from "elliptic"


const N = new BN("115792089237316195423570985008687907852837564279074904382605163141518161494337")
const EC: typeof elliptic.ec = elliptic.ec
const ec: elliptic.ec = new EC("secp256k1")

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
  }
]

async function main() {
    const provider = new JsonRpcProvider("https://coston-api.flare.network/ext/C/rpc")
    const contract = new Contract('0xC06496FA0551bf4996fb5Df876cBcC6F1d836460', abi, provider)
    const action = 'mintAmount'
    const params = ["0x0000000000000000000000000000000000000000", 10]
    const method = contract.getFunction(action)
    const baseTx = await method.populateTransaction(...params)
    const nonce = await provider.getTransactionCount(checksumedAddress)

    const unsignedTx = {
        ...baseTx,
        nonce: nonce,
        chainId: 13,
        gasLimit: "10000000000",
        gasPrice: "100000",
    }

    // external transaction signature
    const tx = Transaction.from(unsignedTx)
    const signature = ec.sign(tx.unsignedHash, Buffer.from(process.env.SIGNER!, 'hex'))
    if (signature.s.gt(N.div(new BN(2)))) signature.s = N.sub(signature.s)

    // sign transaction
    const signedTx = Transaction.from({
        ...unsignedTx,
        from: checksumedAddress,
        signature: {
            r: signature.r.toString(),
            s: signature.s.toString(),
            v: signature.recoveryParam! + 26
        }
    })

    // send transaction (idk why ethers makes this so impossible)
    await provider.send('eth_sendRawTransaction', [signedTx.serialized])
}

main()
