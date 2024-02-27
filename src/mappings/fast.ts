import * as assembly from "../pb/assembly"
import { handlePoolCreated } from './factory';
import { handleIncreaseLiquidity, handleDecreaseLiquidity, handleCollect, handleTransfer } from './position-manager';
import { handleInitialize, handleSwap, handleMint, handleBurn, handleFlash } from './core';
import { Address, BigInt, Bytes, ByteArray, log } from "@graphprotocol/graph-ts";


export class TxDetails {
  address: Address;
  blockNumber: BigInt;
  blockTimestamp: BigInt;
  transactionHash: ByteArray;
  transactionGasUsed: BigInt;
  transactionGasPrice: BigInt;
  constructor(
    address: Address,
    blockNumber: BigInt,
    blockTimestamp: BigInt,
    transactionHash: ByteArray,
    transactionGasUsed: BigInt,
    transactionGasPrice: BigInt,
  ) {

    this.address =
      address;
    this.blockNumber =
      blockNumber;
    this.blockTimestamp =
      blockTimestamp;
    this.transactionHash =
      transactionHash;
    this.transactionGasUsed =
      transactionGasUsed;
    this.transactionGasPrice =
      transactionGasPrice;
  }
};

function txDetailsFromHeader(header: assembly.edgeandnode.uniswap.v1.Event): TxDetails {
  return new TxDetails(
    Address.fromBytes(changetype<Bytes>(header.address)),
    BigInt.fromI32(header.block_number),
    BigInt.fromString(header.block_timestamp),
    Bytes.fromByteArray(changetype<ByteArray>(header.tx_hash)),
    BigInt.fromString(header.tx_gas_used),
    BigInt.fromByteArray(changetype<ByteArray>(header.tx_gas_price.toString())),
  );
}


export function handleBlock(blockBytes: Uint8Array): void {
  const decoded = assembly.edgeandnode.uniswap.v1.Events.decode(blockBytes.buffer);

  decoded.events.forEach((event: assembly.edgeandnode.uniswap.v1.Event) => {
    const txDetails = txDetailsFromHeader(event);
    switch (event.type) {
      case 0: {
        const e = assembly.edgeandnode.uniswap.v1.PoolCreated.decode(changetype<Uint8Array>(event.event.value).buffer);
        handlePoolCreated(txDetails, e);
        break;
      }
      // PositionManager
      case 1: {
        const e = assembly.edgeandnode.uniswap.v1.IncreaseLiquidity.decode(changetype<Uint8Array>(event.event.value).buffer);
        handleIncreaseLiquidity(txDetails, e);
        break;
      }
      case 2: {
        const e = assembly.edgeandnode.uniswap.v1.DecreaseLiquidity.decode(changetype<Uint8Array>(event.event.value).buffer);
        handleDecreaseLiquidity(txDetails, e);
        break;
      }
      case 3: {
        const e = assembly.edgeandnode.uniswap.v1.Collect.decode(changetype<Uint8Array>(event.event.value).buffer);
        handleCollect(txDetails, e);
        break;
      }
      case 4: {
        const e = assembly.edgeandnode.uniswap.v1.Transfer.decode(changetype<Uint8Array>(event.event.value).buffer);
        handleTransfer(txDetails, e);
        break;
      }
      // Pool
      case 5: {
        const e = assembly.edgeandnode.uniswap.v1.Initialize.decode(changetype<Uint8Array>(event.event.value).buffer);
        handleInitialize(txDetails, e);
        break;
      }
      case 6: {
        const e = assembly.edgeandnode.uniswap.v1.Swap.decode(changetype<Uint8Array>(event.event.value).buffer);
        handleSwap(txDetails, e);
        break;
      }
      case 7: {
        const e = assembly.edgeandnode.uniswap.v1.Mint.decode(changetype<Uint8Array>(event.event.value).buffer);
        handleMint(txDetails, e);
        break;
      }
      case 8: {
        const e = assembly.edgeandnode.uniswap.v1.Burn.decode(changetype<Uint8Array>(event.event.value).buffer);
        handleBurn(txDetails, e);
        break;
      }
      // FLASH
      case 9: {
        handleFlash(txDetails);
        break;
      }
    }
  })

}

