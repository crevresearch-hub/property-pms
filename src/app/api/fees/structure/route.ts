import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FEE_STRUCTURE } from '@/lib/fees'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(FEE_STRUCTURE)
  } catch (error) {
    console.error('GET /api/fees/structure error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
