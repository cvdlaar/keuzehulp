import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Flow from '@/models/Flow'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/flows/[id]'>) {
  await connectDB()
  const { id } = await ctx.params
  const flow = await Flow.findById(id).lean()
  if (!flow) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json(flow)
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/flows/[id]'>) {
  await connectDB()
  const { id } = await ctx.params
  const body = await req.json()

  // Volledige flow-update: de client stuurt het hele flow-object terug
  const { name, description, startQuestionId, questions, active, boostConfig, adobeCommerceUrl } = body

  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (description !== undefined) update.description = description
  if (startQuestionId !== undefined) update.startQuestionId = startQuestionId
  if (questions !== undefined) update.questions = questions
  if (active !== undefined) update.active = active
  if (boostConfig !== undefined) update.boostConfig = boostConfig
  if (adobeCommerceUrl !== undefined) update.adobeCommerceUrl = adobeCommerceUrl

  const flow = await Flow.findByIdAndUpdate(id, update, { new: true })
  if (!flow) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json(flow)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/flows/[id]'>) {
  await connectDB()
  const { id } = await ctx.params
  await Flow.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
