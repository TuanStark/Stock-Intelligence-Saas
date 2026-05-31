/**
 * Helper to calculate the pricing bounds (Ceiling/Floor) for a given reference price (TC).
 * HOSE uses 7% price bands.
 */
export const calculatePricingBounds = (basePrice: number) => {
  const tc = Number(basePrice) || 0;
  const tran = Math.round(tc * 1.07);
  const san = Math.round(tc * 0.93);
  return { tc, tran, san };
};

/**
 * Pure helper function to cleanly format a number with localized thousands separator.
 */
export const formatCurrency = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined) return '0';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('vi-VN');
};
