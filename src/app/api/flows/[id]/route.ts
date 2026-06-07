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
  const update: Record<string, unknown> = {}
  const fields = [
    'name','description','startQuestionId','questions','active','boostConfig',
    'adobeCommerceUrl','widgetStyle','widgetBehavior','emailResults','emailSubject',
    'spotlerAttributes','resultsSummaryTemplate','displayAttributes',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) update[f] = body[f]
  }

  const flow = await Flow.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
  if (!flow) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json(flow)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/flows/[id]'>) {
  await connectDB()
  const { id } = await ctx.params
  await Flow.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
