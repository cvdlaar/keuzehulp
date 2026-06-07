import { connectDB } from './db'
import FeedConfig from '@/models/FeedConfig'
import { runImport } from './importer'

let started = false

async function runDueImports() {
  try {
    await connectDB()
    const due = await FeedConfig.find({
      active: true,
      schedule: { $ne: 'none' },
      nextImportAt: { $lte: new Date() },
    })
    for (const config of due) {
      try {
        console.log(`[scheduler] Start import: ${config.name}`)
        await runImport(String(config._id))
      } catch (err) {
        console.error(`[scheduler] Import mislukt voor ${config.name}:`, err)
      }
    }
  } catch (err) {
    console.error('[scheduler] Check mislukt:', err)
  }
}

export function startScheduler() {
  if (started) return
  started = true
  const INTERVAL_MS = 5 * 60 * 1000 // elke 5 minuten
  setInterval(runDueImports, INTERVAL_MS)
  console.log('[scheduler] Gestart — check elke 5 minuten op geplande imports')
}
