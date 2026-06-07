import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import ImportLog from '@/models/ImportLog'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  const log = await ImportLog.findById(id).lean()
  if (!log) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json(log)
}
