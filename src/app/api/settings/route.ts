import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Setting from '@/models/Setting'
import { getSession } from '@/lib/auth'

async function requireAdmin() {
  const session = await getSession()
  return session?.role === 'admin'
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  await connectDB()
  const settings = await Setting.find().lean()
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value
  return NextResponse.json(map)
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  await connectDB()
  const body = await req.json() as Record<string, string>

  await Promise.all(
    Object.entries(body).map(([key, value]) =>
      Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true })
    )
  )

  return NextResponse.json({ ok: true })
}
