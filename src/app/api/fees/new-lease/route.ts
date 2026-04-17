import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calculateFee, FEE_STRUCTURE } from '@/lib/fees'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { annual_rent, property_type } = body

    if (!annual_rent) {
      return NextResponse.json({ error: 'annual_rent is required' }, { status: 400 })
    }

    const rent = parseFloat(annual_rent)
    const type = property_type === 'commercial' ? 'commercial' : 'residential'

    const commissionKey = `new_lease_${type}`
    const depositKey = `security_deposit_${type}`

    const commission = calculateFee(commissionKey, rent)
    const deposit = calculateFee(depositKey, rent)
    const ejari = calculateFee('ejari', rent)
    const municipality = calculateFee('municipality', rent)

    const total = commission + deposit + ejari + municipality

    return NextResponse.json({
      annual_rent: rent,
      property_type: type,
      fees: {
        commission: {
          name: FEE_STRUCTURE[commissionKey].name,
          amount: commission,
          beneficiary: FEE_STRUCTURE[commissionKey].beneficiary,
        },
        security_deposit: {
          name: FEE_STRUCTURE[depositKey].name,
          amount: deposit,
          beneficiary: FEE_STRUCTURE[depositKey].beneficiary,
        },
        ejari: {
          name: FEE_STRUCTURE.ejari.name,
          amount: ejari,
          beneficiary: FEE_STRUCTURE.ejari.beneficiary,
        },
        municipality: {
          name: FEE_STRUCTURE.municipality.name,
          amount: municipality,
          beneficiary: FEE_STRUCTURE.municipality.beneficiary,
        },
      },
      total,
    })
  } catch (error) {
    console.error('POST /api/fees/new-lease error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
