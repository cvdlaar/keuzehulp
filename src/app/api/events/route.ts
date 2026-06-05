import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Event from '@/models/Event'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { flowId, sessionId, type, data } = body

  if (!flowId || !sessionId || !type) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await connectDB()
  await Event.create({ flowId, sessionId, type, data: data ?? {} })
  return NextResponse.json({ ok: true })
}
