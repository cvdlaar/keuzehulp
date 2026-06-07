import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Flow from '@/models/Flow'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/demo/[id]'>) {
  await connectDB()
  const { id } = await ctx.params
  const flow = await Flow.findById(id).select('name demoEnabled').lean()
  if (!flow) return NextResponse.json(null, { status: 404 })
  return NextResponse.json({ _id: String(flow._id), name: flow.name, demoEnabled: flow.demoEnabled ?? false })
}
