import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import FeedConfig from '@/models/FeedConfig'

export async function GET() {
  await connectDB()
  const configs = await FeedConfig.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json(configs)
}

export async function POST(req: NextRequest) {
  await connectDB()
  const body = await req.json()
  const { name, url, format } = body

  if (!name || !url) {
    return NextResponse.json({ error: 'Naam en URL zijn verplicht' }, { status: 400 })
  }

  const config = await FeedConfig.create({ name, url, format: format || 'xml' })
  return NextResponse.json(config, { status: 201 })
}

export async function PUT(req: NextRequest) {
  await connectDB()
  const body = await req.json()
  const { id, name, url, format, active, fieldMapping } = body

  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (url !== undefined) update.url = url
  if (format !== undefined) update.format = format
  if (active !== undefined) update.active = active
  if (fieldMapping !== undefined) update.fieldMapping = fieldMapping

  const config = await FeedConfig.findByIdAndUpdate(id, update, { new: true })

  if (!config) {
    return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  }

  return NextResponse.json(config)
}

export async function DELETE(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  await FeedConfig.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
