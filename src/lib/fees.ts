/**
 * Alwaan Fee Structure from Operation Manual.
 * All amounts are in AED and include VAT where applicable.
 */

export interface FeeDefinition {
  name: string
  type: 'fixed' | 'percentage' | 'months_rent' | 'percentage_deposit'
  beneficiary: string
  amount?: number
  rate?: number
  min?: number
  months?: number
}

export const FEE_STRUCTURE: Record<string, FeeDefinition> = {
  new_lease_residential: {
    name: 'New Lease Commission (Residential)',
    rate: 0.05,
    min: 1050,
    type: 'percentage',
    beneficiary: 'Alwaan',
  },
  new_lease_commercial: {
    name: 'New Lease Commission (Commercial)',
    rate: 0.10,
    min: 1050,
    type: 'percentage',
    beneficiary: 'Alwaan',
  },
  renewal_residential: {
    name: 'Renewal Fee (Residential)',
    amount: 850,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  renewal_commercial: {
    name: 'Renewal Fee (Commercial)',
    amount: 1500,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  ejari: {
    name: 'EJARI Registration',
    amount: 250,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  municipality: {
    name: 'Municipality Service Charge',
    amount: 210,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  cheque_replacement: {
    name: 'Cheque Replacement',
    amount: 262.50,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  cheque_postponement: {
    name: 'Cheque Postponement',
    amount: 262.50,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  bounced_cheque: {
    name: 'Bounced Cheque Fine',
    amount: 525,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  late_renewal_15: {
    name: 'Late Renewal (within 15 days)',
    amount: 525,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  late_renewal_30: {
    name: 'Late Renewal (within 30 days)',
    amount: 1050,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  early_termination_residential: {
    name: 'Early Termination (Residential)',
    months: 2,
    type: 'months_rent',
    beneficiary: 'Landlord',
  },
  early_termination_commercial: {
    name: 'Early Termination (Commercial)',
    months: 3,
    type: 'months_rent',
    beneficiary: 'Landlord',
  },
  name_change_residential: {
    name: 'Name Change / Transfer (Residential)',
    rate: 0.05,
    min: 0,
    type: 'percentage',
    beneficiary: 'Alwaan',
  },
  name_change_commercial: {
    name: 'Name Change / Transfer (Commercial)',
    rate: 0.10,
    min: 0,
    type: 'percentage',
    beneficiary: 'Alwaan',
  },
  certification_letter: {
    name: 'Certification Letter',
    amount: 100,
    type: 'fixed',
    beneficiary: 'Alwaan',
  },
  security_deposit_residential: {
    name: 'Security Deposit (Residential)',
    rate: 0.05,
    type: 'percentage_deposit',
    beneficiary: 'Refundable',
  },
  security_deposit_commercial: {
    name: 'Security Deposit (Commercial)',
    rate: 0.10,
    type: 'percentage_deposit',
    beneficiary: 'Refundable',
  },
}

/**
 * Calculate a fee amount based on the fee key and optional annual rent.
 * Returns 0 if the fee key is not found.
 */
export function calculateFee(feeKey: string, annualRent: number = 0): number {
  const fee = FEE_STRUCTURE[feeKey]
  if (!fee) return 0

  switch (fee.type) {
    case 'fixed':
      return fee.amount ?? 0

    case 'percentage':
      const calculated = annualRent * (fee.rate ?? 0)
      return Math.max(calculated, fee.min ?? 0)

    case 'months_rent': {
      const monthlyRent = annualRent / 12
      return monthlyRent * (fee.months ?? 0)
    }

    case 'percentage_deposit':
      return annualRent * (fee.rate ?? 0)

    default:
      return 0
  }
}
