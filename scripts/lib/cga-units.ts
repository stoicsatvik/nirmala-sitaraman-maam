/** Convert a CGA amount expressed in crore INR into an integer number of rupees.
 *
 * The CGA source reports aggregate decimal crore figures. Direct floating-point
 * multiplication can serialize fractional-rupee artifacts (for example
 * 187037.42 * 10_000_000 = 1870374200000.0002). Do not invent paise or round
 * an unrepresentable or sub-rupee source amount without recording a failure.
 */
export function croreToExactRupees(crore: number): number {
  if (!Number.isFinite(crore)) {
    throw new RangeError("CGA crore amount must be finite");
  }
  const rawRupees = crore * 10_000_000;
  const roundedRupees = Math.round(rawRupees);
  if (!Number.isSafeInteger(roundedRupees)) {
    throw new RangeError("CGA rupee amount exceeds safe integer precision");
  }
  if (Math.abs(roundedRupees / 10_000_000 - crore) > 1e-9) {
    throw new RangeError("CGA crore amount has unsupported sub-rupee precision");
  }
  return roundedRupees;
}
