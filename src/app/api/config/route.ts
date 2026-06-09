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

const SCHEDULE_INTERVALS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily:  24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

export async function PUT(req: NextRequest) {
  await connectDB()
  const body = await req.json()
  const { id, name, url, format, active, storeView, fieldMapping, attributeMapping, schedule } = body

  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (url !== undefined) update.url = url
  if (format !== undefined) update.format = format
  if (active !== undefined) update.active = active
  if (storeView !== undefined) update.storeView = storeView
  if (fieldMapping !== undefined) update.fieldMapping = fieldMapping
  if (attributeMapping !== undefined) update.attributeMapping = attributeMapping
  if (schedule !== undefined) {
    update.schedule = schedule
    // Zet nextImportAt als er een schema wordt ingesteld en het nog niet is gepland
    if (schedule !== 'none') {
      const existing = await FeedConfig.findById(id).select('nextImportAt').lean()
      if (!existing?.nextImportAt || existing.nextImportAt < new Date()) {
        const interval = SCHEDULE_INTERVALS[schedule]
        if (interval) update.nextImportAt = new Date(Date.now() + interval)
      }
    } else {
      update.nextImportAt = null
    }
  }

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
