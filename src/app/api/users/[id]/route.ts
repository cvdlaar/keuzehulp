import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import User from '@/models/User'
import { getSession } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

async function requireAdmin() {
  const session = await getSession()
  return session?.role === 'admin'
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  await connectDB()
  const { id } = await params
  const patch = await req.json()

  const allowed = ['role', 'active', 'name']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (patch[key] !== undefined) update[key] = patch[key]
  }
  if (patch.password && patch.password.length >= 8) {
    update.passwordHash = await bcrypt.hash(patch.password, 12)
  }

  const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-passwordHash').lean()
  if (!user) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  await connectDB()
  const { id } = await params
  await User.findByIdAndUpdate(id, { active: false })
  return NextResponse.json({ ok: true })
}
