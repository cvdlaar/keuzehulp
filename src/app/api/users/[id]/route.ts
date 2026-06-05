import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import User from '@/models/User'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  const patch = await req.json()

  const allowed = ['role', 'active', 'name']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (patch[key] !== undefined) update[key] = patch[key]
  }

  const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-passwordHash').lean()
  if (!user) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  await User.findByIdAndUpdate(id, { active: false })
  return NextResponse.json({ ok: true })
}
