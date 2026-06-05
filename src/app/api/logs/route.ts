import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import ImportLog from '@/models/ImportLog'

export async function GET(req: NextRequest) {
  await connectDB()

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '20')

  const logs = await ImportLog.find()
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean()

  return NextResponse.json(logs)
}
