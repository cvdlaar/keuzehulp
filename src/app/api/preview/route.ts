import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
import Papa from 'papaparse'
import { connectDB } from '@/lib/db'
import FeedConfig from '@/models/FeedConfig'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

  const config = await FeedConfig.findById(id)
  if (!config) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const response = await axios.get<string>(config.url, {
    responseType: 'text',
    timeout: 30000,
  })

  const raw = response.data

  if (config.format === 'csv') {
    const result = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: true,
      preview: 3,
    })
    return NextResponse.json({ format: 'csv', headers: result.meta.fields, sample: result.data })
  }

  // XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    removeNSPrefix: true,
  })
  const parsed = parser.parse(raw) as Record<string, unknown>

  // Vind de eerste item
  function findItems(obj: unknown, depth = 0): unknown[] {
    if (depth > 5 || !obj || typeof obj !== 'object') return []
    const o = obj as Record<string, unknown>
    for (const key of Object.keys(o)) {
      const val = o[key]
      if (key === 'item' || key === 'entry' || key === 'product') {
        return Array.isArray(val) ? val.slice(0, 3) : [val]
      }
      const found = findItems(val, depth + 1)
      if (found.length) return found
    }
    return []
  }

  const items = findItems(parsed)
  const topLevelKeys = Object.keys(parsed)

  return NextResponse.json({
    format: 'xml',
    topLevelKeys,
    sampleItems: items,
    rawStructureKeys: items[0] ? Object.keys(items[0] as object) : [],
  })
}
