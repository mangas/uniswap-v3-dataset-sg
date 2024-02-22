import * as assembly from "../pb/assembly"
import { handlePoolCreated } from './factory';
import { handleIncreaseLiquidity, handleDecreaseLiquidity, handleCollect, handleTransfer, TxDetails } from './position-manager';
import { handleInitialize, handleSwap, handleMint, handleBurn, handleFlash } from './core';
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";


function txDetailsFromHeader(header: assembly.edgeandnode.v1.Event): TxDetails {
  return {
    address: Address.fromUint8Array(Uint8Array.from(header.address)),
    blockNumber: header.block_number,
    blockTimestamp: BigInt.fromString(header.block_timestamp),
    transactionGasUsed: BigInt.fromString(header.tx_gas_used),
    transactionGasPrice: BigInt.fromString(header.tx_gas_price),
    transactionHash: Bytes.fromUint8Array(Uint8Array.from(header.tx_hash)),
  };
}

const EventType = assembly.edgeandnode.uniswap.v1.EventType;

export function handleBlock(blockBytes: Uint8Array): void {
  const decoded = assembly.edgeandnode.uniswap.v1.Events.decode(blockBytes.buffer);

  decoded.events.forEach((event: assembly.edgeandnode.uniswap.v1.Event) => {
    const txDetails = txDetailsFromHeader(event);
    switch (event.type) {
      case EventType.POOL_CREATED: {
        const e = assembly.edgeandnode.uniswap.v1.PoolCreated.decode(Uint8Array.from(event.event.value));
        handlePoolCreated(txDetails, e);
        break;
      }
      // PositionManager
      case EventType.INCREASE_LIQUIDITY: {
        const e = assembly.edgeandnode.uniswap.v1.IncreaseLiquidity.decode(Uint8Array.from(event.event.value));
        handleIncreaseLiquidity(txDetails, e);
        break;
      }
      case EventType.DECREASE_LIQUIDITY: {
        const e = assembly.edgeandnode.uniswap.v1.DecreaseLiquidity.decode(Uint8Array.from(event.event.value));
        handleDecreaseLiquidity(txDetails, e);
        break;
      }
      case EventType.COLLECT: {
        const e = assembly.edgeandnode.uniswap.v1.Collect.decode(Uint8Array.from(event.event.value));
        handleCollect(txDetails, e);
        break;
      }
      case EventType.TRANSFER: {
        const e = assembly.edgeandnode.uniswap.v1.Transfer.decode(Uint8Array.from(event.event.value));
        handleTransfer(txDetails, e);
        break;
      }
      // Pool
      case EventType.INITIALIZE: {
        const e = assembly.edgeandnode.uniswap.v1.Initialize.decode(Uint8Array.from(event.event.value));
        handleInitialize(txDetails, e);
        break;
      }
      case EventType.SWAP: {
        const e = assembly.edgeandnode.uniswap.v1.Swap.decode(Uint8Array.from(event.event.value));
        handleSwap(txDetails, e);
        break;
      }
      case EventType.MINT: {
        const e = assembly.edgeandnode.uniswap.v1.Mint.decode(Uint8Array.from(event.event.value));
        handleMint(txDetails, e);
        break;
      }
      case EventType.BURN: {
        const e = assembly.edgeandnode.uniswap.v1.Burn.decode(Uint8Array.from(event.event.value));
        handleBurn(txDetails, e);
        break;
      }
      case EventType.FLASH: {
        handleFlash(txDetails);
        break;
      }
    }
  })

}

