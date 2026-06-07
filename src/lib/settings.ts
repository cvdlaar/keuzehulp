import { connectDB } from './db'
import Setting from '@/models/Setting'

let cache: Record<string, string> | null = null
let cacheAt = 0

export async function getSetting(key: string): Promise<string> {
  // Cache voor 60 seconden
  if (!cache || Date.now() - cacheAt > 60_000) {
    await connectDB()
    const all = await Setting.find().lean()
    cache = Object.fromEntries(all.map(s => [s.key, s.value]))
    cacheAt = Date.now()
  }
  return cache[key] ?? ''
}

// Geeft DB-waarde terug als die niet leeg is, anders de env var
export async function getSettingOrEnv(key: string, envVar: string): Promise<string> {
  const dbVal = await getSetting(key)
  return dbVal || process.env[envVar] || ''
}
