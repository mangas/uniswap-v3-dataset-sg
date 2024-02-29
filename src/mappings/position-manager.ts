/* eslint-disable prefer-const */
import {
  NonfungiblePositionManager,
} from '../types/NonfungiblePositionManager/NonfungiblePositionManager'
import { Position, PositionSnapshot, Token } from '../types/schema'
import { ADDRESS_ZERO, factoryContract, ZERO_BD, ZERO_BI } from '../utils/constants'
import { Address, BigInt, ByteArray, Bytes } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal, loadTransaction } from '../utils'
import * as assembly from "../pb/assembly"
import { TxDetails } from './fast'



function getPosition(address: Address, tokenId: BigInt, txDetails: TxDetails): Position | null {
  let position = Position.load(tokenId.toString())
  if (position === null) {
    let contract = NonfungiblePositionManager.bind(address)
    let positionCall = contract.try_positions(tokenId)

    // the following call reverts in situations where the position is minted
    // and deleted in the same block - from my investigation this happens
    // in calls from  BancorSwap
    // (e.g. 0xf7867fa19aa65298fadb8d4f72d0daed5e836f3ba01f0b9b9631cdc6c36bed40)
    if (!positionCall.reverted) {
      let positionResult = positionCall.value
      let poolAddress = factoryContract.getPool(positionResult.value2, positionResult.value3, positionResult.value4)

      position = new Position(tokenId.toString())
      // The owner gets correctly updated in the Transfer handler
      position.owner = Address.fromString(ADDRESS_ZERO)
      position.pool = poolAddress.toHexString()
      position.token0 = positionResult.value2.toHexString()
      position.token1 = positionResult.value3.toHexString()
      position.tickLower = position.pool.concat('#').concat(positionResult.value5.toString())
      position.tickUpper = position.pool.concat('#').concat(positionResult.value6.toString())
      position.liquidity = ZERO_BI
      position.depositedToken0 = ZERO_BD
      position.depositedToken1 = ZERO_BD
      position.withdrawnToken0 = ZERO_BD
      position.withdrawnToken1 = ZERO_BD
      position.collectedFeesToken0 = ZERO_BD
      position.collectedFeesToken1 = ZERO_BD
      position.transaction = loadTransaction(txDetails).id
      position.feeGrowthInside0LastX128 = positionResult.value8
      position.feeGrowthInside1LastX128 = positionResult.value9
    }
  }

  return position
}

function updateFeeVars(position: Position, address: Address, tokenId: BigInt): Position {
  let positionManagerContract = NonfungiblePositionManager.bind(address)
  let positionResult = positionManagerContract.try_positions(tokenId)
  if (!positionResult.reverted) {
    position.feeGrowthInside0LastX128 = positionResult.value.value8
    position.feeGrowthInside1LastX128 = positionResult.value.value9
  }
  return position
}

function savePositionSnapshot(position: Position, event: TxDetails): void {
  let positionSnapshot = new PositionSnapshot(position.id.concat('#').concat(event.blockNumber.toString()))
  positionSnapshot.owner = position.owner
  positionSnapshot.pool = position.pool
  positionSnapshot.position = position.id
  positionSnapshot.blockNumber = event.blockNumber
  positionSnapshot.timestamp = event.blockTimestamp
  positionSnapshot.liquidity = position.liquidity
  positionSnapshot.depositedToken0 = position.depositedToken0
  positionSnapshot.depositedToken1 = position.depositedToken1
  positionSnapshot.withdrawnToken0 = position.withdrawnToken0
  positionSnapshot.withdrawnToken1 = position.withdrawnToken1
  positionSnapshot.collectedFeesToken0 = position.collectedFeesToken0
  positionSnapshot.collectedFeesToken1 = position.collectedFeesToken1
  positionSnapshot.transaction = loadTransaction(event).id
  positionSnapshot.feeGrowthInside0LastX128 = position.feeGrowthInside0LastX128
  positionSnapshot.feeGrowthInside1LastX128 = position.feeGrowthInside1LastX128
  positionSnapshot.save()
}

export function handleIncreaseLiquidity(txDetails: TxDetails, event: assembly.edgeandnode.uniswap.v1.IncreaseLiquidity): void {
  // temp fix
  if (txDetails.blockNumber.equals(BigInt.fromI32(14317993))) {
    return
  }

  const address = Address.fromString(ADDRESS_ZERO);
  const tokenId = BigInt.fromString(event.token_id);

  let position = getPosition(
    address,
    tokenId,
    txDetails,
  )

  // position was not able to be fetched
  if (position == null) {
    return
  }

  // temp fix
  if (Address.fromString(position.pool).equals(Address.fromHexString('0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248'))) {
    return
  }

  let token0 = Token.load(position.token0)!
  let token1 = Token.load(position.token1)!

  let amount0 = convertTokenToDecimal(BigInt.fromString(event.amount0), token0.decimals)
  let amount1 = convertTokenToDecimal(BigInt.fromString(event.amount1), token1.decimals)

  position.liquidity = position.liquidity.plus(BigInt.fromString(event.liquidity))
  position.depositedToken0 = position.depositedToken0.plus(amount0)
  position.depositedToken1 = position.depositedToken1.plus(amount1)

  updateFeeVars(position, address, tokenId)

  position.save()

  savePositionSnapshot(position, txDetails)
}

export function handleDecreaseLiquidity(txDetails: TxDetails, event: assembly.edgeandnode.uniswap.v1.DecreaseLiquidity): void {
  // temp fix
  if (txDetails.blockNumber == BigInt.fromI32(14317993)) {
    return
  }

  const address = Address.fromString(ADDRESS_ZERO);
  const tokenId = BigInt.fromString(event.token_id);

  let position = getPosition(
    address,
    tokenId,
    txDetails,
  )

  // position was not able to be fetched
  if (position == null) {
    return
  }

  // temp fix
  if (Address.fromString(position.pool).equals(Address.fromString('0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248'))) {
    return
  }

  let token0 = Token.load(position.token0)!
  let token1 = Token.load(position.token1)!
  let amount0 = convertTokenToDecimal(BigInt.fromString(event.amount0), token0.decimals)
  let amount1 = convertTokenToDecimal(BigInt.fromString(event.amount1), token1.decimals)

  position.liquidity = position.liquidity.minus(BigInt.fromString(event.liquidity))
  position.withdrawnToken0 = position.withdrawnToken0.plus(amount0)
  position.withdrawnToken1 = position.withdrawnToken1.plus(amount1)

  position = updateFeeVars(position, address, tokenId)
  position.save()
  savePositionSnapshot(position, txDetails)
}

export function handleCollect(txDetails: TxDetails, event: assembly.edgeandnode.uniswap.v1.Collect): void {
  const address = Address.fromString(ADDRESS_ZERO);
  const tokenId = BigInt.fromString(event.token_id);

  let position = getPosition(
    address,
    tokenId,
    txDetails,
  )

  // position was not able to be fetched
  if (position == null) {
    return
  }
  if (Address.fromString(position.pool).equals(Address.fromString('0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248'))) {
    return
  }

  let token0 = Token.load(position.token0)!
  let amount0 = convertTokenToDecimal(BigInt.fromString(event.amount0), token0.decimals)
  position.collectedFeesToken0 = position.collectedFeesToken0.plus(amount0)
  position.collectedFeesToken1 = position.collectedFeesToken1.plus(amount0)

  position = updateFeeVars(position, address, tokenId)
  position.save()
  savePositionSnapshot(position, txDetails)
}

export function handleTransfer(txDetails: TxDetails, event: assembly.edgeandnode.uniswap.v1.Transfer): void {
  const address = Address.fromString(ADDRESS_ZERO);
  const tokenId = BigInt.fromString(event.token_id);

  let position = getPosition(
    address,
    tokenId,
    txDetails,
  )

  // position was not able to be fetched
  if (position == null) {
    return
  }

  position.owner = Bytes.fromUint8Array(changetype<Uint8Array>(event.to));
  position.save()

  savePositionSnapshot(position, txDetails)
}
