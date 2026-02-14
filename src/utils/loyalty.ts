import { supabase } from '../lib/supabase';

export interface LoyaltyConfig {
  points_per_rupee: number;
  redemption_value_per_point: number;
  min_invoice_value: number;
  max_redeem_percentage: number;
}

export async function getLoyaltyConfig(): Promise<LoyaltyConfig | null> {
  const { data, error } = await supabase
    .from('loyalty_config')
    .select('*')
    .eq('active', true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as LoyaltyConfig;
}

export function calculateLoyaltyPoints(
  invoiceAmount: number,
  pointsPerRupee: number
): number {
  return parseFloat((invoiceAmount * pointsPerRupee).toFixed(2));
}

export function calculateRedemptionAmount(
  points: number,
  redemptionValuePerPoint: number
): number {
  return parseFloat((points * redemptionValuePerPoint).toFixed(2));
}

export function validateRedemption(
  pointsToRedeem: number,
  availablePoints: number,
  invoiceAmount: number,
  config: LoyaltyConfig
): { valid: boolean; error?: string; maxAllowed?: number } {
  if (pointsToRedeem > availablePoints) {
    return {
      valid: false,
      error: `Insufficient points. Available: ${availablePoints}`,
    };
  }

  if (invoiceAmount < config.min_invoice_value) {
    return {
      valid: false,
      error: `Minimum invoice value for redemption: ₹${config.min_invoice_value}`,
    };
  }

  const redemptionAmount = calculateRedemptionAmount(
    pointsToRedeem,
    config.redemption_value_per_point
  );

  const maxAllowedAmount = (invoiceAmount * config.max_redeem_percentage) / 100;

  if (redemptionAmount > maxAllowedAmount) {
    const maxPoints = Math.floor(maxAllowedAmount / config.redemption_value_per_point);
    return {
      valid: false,
      error: `Maximum ${config.max_redeem_percentage}% of invoice can be redeemed`,
      maxAllowed: maxPoints,
    };
  }

  return { valid: true };
}
