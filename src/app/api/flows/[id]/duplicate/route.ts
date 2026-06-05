import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Flow from '@/models/Flow'

export async function POST(_req: NextRequest, ctx: RouteContext<'/api/flows/[id]/duplicate'>) {
  await connectDB()
  const { id } = await ctx.params

  const original = await Flow.findById(id).lean()
  if (!original) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const { _id, createdAt, updatedAt, ...rest } = original as Record<string, unknown>
  void _id; void createdAt; void updatedAt

  const copy = await Flow.create({
    ...rest,
    name: `Kopie van ${original.name}`,
    active: false,
  })

  return NextResponse.json(copy, { status: 201 })
}
