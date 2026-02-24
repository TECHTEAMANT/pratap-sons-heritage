export type GSTTransactionType = 'CGST_SGST' | 'IGST' | 'flat_5';

export interface GSTBreakdown {
  gstType: GSTTransactionType;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGstAmount: number;
}

export function calculateGSTBreakdown(
  gstAmount: number,
  gstType: GSTTransactionType
): GSTBreakdown {
  if (gstType === 'IGST') {
    return {
      gstType: 'IGST',
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: gstAmount,
      totalGstAmount: gstAmount,
    };
  } else {
    // Both 'CGST_SGST' and 'flat_5' split as CGST + SGST
    return {
      gstType,
      cgstAmount: gstAmount / 2,
      sgstAmount: gstAmount / 2,
      igstAmount: 0,
      totalGstAmount: gstAmount,
    };
  }
}

export function determineGSTType(
  supplierState: string | null,
  customerState: string | null
): GSTTransactionType {
  if (!supplierState || !customerState) {
    return 'CGST_SGST';
  }

  return supplierState.toLowerCase() === customerState.toLowerCase()
    ? 'CGST_SGST'
    : 'IGST';
}
