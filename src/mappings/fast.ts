import * as assembly from "../pb/assembly"
import { handlePoolCreated } from './factory';
import { handleIncreaseLiquidity, handleDecreaseLiquidity, handleCollect, handleTransfer } from './position-manager';
import { handleInitialize, handleSwap, handleMint, handleBurn, handleFlash } from './core';
import { Address, BigInt, Bytes, ByteArray, log } from "@graphprotocol/graph-ts";
import { ADDRESS_ZERO } from "../utils/constants";


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

export function txDetailsFromHeader(header: assembly.edgeandnode.uniswap.v1.Event): TxDetails {
  log.error("#### address: {}", [header.address]);

  let addr = "0x" + header.address;
  if (header.address.length == 0)
    addr = ADDRESS_ZERO


  return new TxDetails(
    Address.fromString(addr),
    BigInt.fromI32(header.block_number),
    BigInt.fromString(header.block_timestamp),
    Bytes.fromHexString(header.tx_hash),
    BigInt.fromString(header.tx_gas_used),
    BigInt.fromString(header.tx_gas_price),
  );
}


export function handleBlock(blockBytes: Uint8Array): void {
  const decoded = assembly.edgeandnode.uniswap.v1.Events.decode(blockBytes.buffer);


  decoded.events.forEach((event: assembly.edgeandnode.uniswap.v1.Event) => {
    const txDetails = txDetailsFromHeader(event);

    const x = new Uint8Array(event.event.value.length);
    for (let i = 0; i < event.event.value.length; i++) {
      x[i] = event.event.value[i];
    }


    switch (event.type) {
      case 0: {

        // const e = assembly.edgeandnode.uniswap.v1.PoolCreated.decode(x.buffer);
        handlePoolCreated(txDetails, event.poolcreated!);
        break;
      }
      // PositionManager
      case 1: {
        // const e = assembly.edgeandnode.uniswap.v1.IncreaseLiquidity.decode(x.buffer);
        handleIncreaseLiquidity(txDetails, event.increaseliquidity!);
        break;
      }
      case 2: {
        // const e = assembly.edgeandnode.uniswap.v1.DecreaseLiquidity.decode(x.buffer);
        handleDecreaseLiquidity(txDetails, event.decreaseliquidity!);
        break;
      }
      case 3: {
        // const e = assembly.edgeandnode.uniswap.v1.Collect.decode(x.buffer);
        handleCollect(txDetails, event.collect!);
        break;
      }
      case 4: {
        // const e = assembly.edgeandnode.uniswap.v1.Transfer.decode(x.buffer);
        handleTransfer(txDetails, event.transfer!);
        break;
      }
      // Pool
      case 5: {
        // const e = assembly.edgeandnode.uniswap.v1.Initialize.decode(x.buffer);
        handleInitialize(txDetails, event.initialize!);
        break;
      }
      case 6: {
        // const e = assembly.edgeandnode.uniswap.v1.Swap.decode(x.buffer);
        handleSwap(txDetails, event.swap!);
        break;
      }
      case 7: {
        // const e = assembly.edgeandnode.uniswap.v1.Mint.decode(x.buffer);
        handleMint(txDetails, event.mint!);
        break;
      }
      case 8: {
        // const e = assembly.edgeandnode.uniswap.v1.Burn.decode(x.buffer);
        handleBurn(txDetails, event.burn!);
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

