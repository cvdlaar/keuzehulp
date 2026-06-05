import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import FeedConfig from '@/models/FeedConfig'
import { runImport } from '@/lib/importer'

// Roep dit endpoint aan via een Windows Scheduled Task of externe cron:
//   Invoke-WebRequest -Uri "http://localhost:3000/api/cron" -Headers @{Authorization="Bearer $env:CRON_SECRET"}
// Stel CRON_SECRET in via .env.local

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await connectDB()
  const due = await FeedConfig.find({
    active: true,
    schedule: { $ne: 'none' },
    nextImportAt: { $lte: new Date() },
  })

  if (due.length === 0) {
    return NextResponse.json({ triggered: 0, message: 'Niets te doen' })
  }

  const results: { feedName: string; logId: string }[] = []
  for (const config of due) {
    try {
      const logId = await runImport(String(config._id))
      results.push({ feedName: config.name, logId })
    } catch {
      results.push({ feedName: config.name, logId: 'error' })
    }
  }

  return NextResponse.json({ triggered: results.length, results })
}
