const basisPoints = 10_000n;

export function ceilDivide(numerator: bigint, denominator: bigint) {
  if (numerator < 0n || denominator <= 0n) throw new Error("Invalid positive integer ratio");
  return (numerator + denominator - 1n) / denominator;
}

export function bufferedPaymentTarget(deficit: bigint) {
  if (deficit <= 0n) return 0n;
  const percentageBuffer = ceilDivide(deficit * 200n, basisPoints);
  const minimumBuffer = 1_000n; // 0.001 USDC at six decimals.
  return deficit + (percentageBuffer > minimumBuffer ? percentageBuffer : minimumBuffer);
}

export function proportionalSwapInput(sampleInput: bigint, sampleOutput: bigint, targetOutput: bigint) {
  if (sampleInput <= 0n || sampleOutput <= 0n || targetOutput <= 0n) {
    throw new Error("Swap quote must contain positive amounts");
  }
  return ceilDivide(sampleInput * targetOutput, sampleOutput);
}
