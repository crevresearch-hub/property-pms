import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FEE_STRUCTURE, calculateFee } from '@/lib/fees'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fee_type, annual_rent } = body

    if (!fee_type) {
      return NextResponse.json({ error: 'fee_type is required' }, { status: 400 })
    }

    const feeDef = FEE_STRUCTURE[fee_type]
    if (!feeDef) {
      return NextResponse.json({ error: 'Unknown fee type' }, { status: 400 })
    }

    const amount = calculateFee(fee_type, annual_rent || 0)

    return NextResponse.json({
      fee_type,
      name: feeDef.name,
      type: feeDef.type,
      beneficiary: feeDef.beneficiary,
      annual_rent: annual_rent || 0,
      calculated_amount: amount,
    })
  } catch (error) {
    console.error('POST /api/fees/calculate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
