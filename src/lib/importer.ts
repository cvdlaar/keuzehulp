import axios from 'axios'
import { connectDB } from './db'
import Product from '@/models/Product'
import FeedConfig from '@/models/FeedConfig'
import ImportLog from '@/models/ImportLog'
import { DEFAULT_MAPPING, type FieldMapping } from '@/lib/mappingConstants'
import type { ParsedProduct } from './parsers/xml'
import { XMLParser } from 'fast-xml-parser'
import Papa from 'papaparse'

function parsePrice(val: string | number | undefined): number {
  if (!val) return 0
  return parseFloat(String(val).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
}

type AnyRecord = Record<string, unknown>

function applyMapping(raw: AnyRecord, mapping: FieldMapping): ParsedProduct {
  const get = (field: string): string => {
    if (!field) return ''
    const val = raw[field]
    return val !== undefined && val !== null ? String(val) : ''
  }

  const attributes: Record<string, string> = {}
  const mappedValues = new Set(Object.values(mapping))
  for (const [k, v] of Object.entries(raw)) {
    if (!mappedValues.has(k) && v !== null && v !== undefined) {
      attributes[k] = String(v)
    }
  }

  return {
    externalId: get(mapping.externalId),
    title: get(mapping.title),
    description: get(mapping.description),
    shortDescription: get(mapping.shortDescription),
    link: get(mapping.link),
    imageLink: get(mapping.imageLink),
    price: parsePrice(raw[mapping.price] as string),
    salePrice: mapping.salePrice && raw[mapping.salePrice] ? parsePrice(raw[mapping.salePrice] as string) : null,
    lowestPrice: mapping.lowestPrice && raw[mapping.lowestPrice] ? parsePrice(raw[mapping.lowestPrice] as string) : null,
    availability: get(mapping.availability),
    brand: get(mapping.brand),
    ean: get(mapping.ean),
    sku: get(mapping.sku),
    category: get(mapping.category),
    attributes,
  }
}

function extractXMLItems(xml: string): AnyRecord[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    removeNSPrefix: true,
  })
  const data = parser.parse(xml) as AnyRecord

  function findItems(obj: unknown, depth = 0): AnyRecord[] {
    if (depth > 5 || !obj || typeof obj !== 'object') return []
    const o = obj as AnyRecord
    for (const key of Object.keys(o)) {
      if (key === 'item' || key === 'entry' || key === 'product') {
        const val = o[key]
        return Array.isArray(val) ? (val as AnyRecord[]) : [val as AnyRecord]
      }
      const found = findItems(o[key], depth + 1)
      if (found.length) return found
    }
    return []
  }

  return findItems(data)
}

function extractCSVItems(csv: string): AnyRecord[] {
  const result = Papa.parse<AnyRecord>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return result.data
}

export async function runImport(feedConfigId: string): Promise<string> {
  await connectDB()

  const config = await FeedConfig.findById(feedConfigId)
  if (!config) throw new Error('Feed configuratie niet gevonden')

  const mapping: FieldMapping = { ...DEFAULT_MAPPING, ...(config.fieldMapping ?? {}) }

  const log = await ImportLog.create({
    feedConfigId: config._id,
    feedName: config.name,
    status: 'running',
    startedAt: new Date(),
  })

  try {
    const response = await axios.get<string>(config.url, {
      responseType: 'text',
      timeout: 30000,
      headers: { 'Accept-Encoding': 'gzip' },
    })

    const rawItems = config.format === 'csv'
      ? extractCSVItems(response.data)
      : extractXMLItems(response.data)

    const products = rawItems.map((item) => applyMapping(item, mapping))

    let imported = 0
    let updated = 0
    let skipped = 0
    const importErrors: string[] = []

    for (const p of products) {
      if (!p.externalId) {
        skipped++
        continue
      }
      try {
        const existing = await Product.findOne({ externalId: p.externalId })
        if (existing) {
          await Product.updateOne({ externalId: p.externalId }, { $set: p })
          updated++
        } else {
          await Product.create(p)
          imported++
        }
      } catch (err) {
        importErrors.push(`${p.externalId}: ${err instanceof Error ? err.message : 'onbekende fout'}`)
      }
    }

    await ImportLog.updateOne(
      { _id: log._id },
      {
        status: importErrors.length > 0 && imported + updated === 0 ? 'error' : 'success',
        imported,
        updated,
        skipped,
        importErrors,
        completedAt: new Date(),
        totalInFeed: rawItems.length,
      }
    )

    const scheduleIntervals: Record<string, number> = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
    }
    const interval = scheduleIntervals[config.schedule ?? 'none']
    const nextImportAt = interval ? new Date(Date.now() + interval) : null
    await FeedConfig.updateOne({ _id: config._id }, { lastImportAt: new Date(), nextImportAt })

    return String(log._id)
  } catch (err) {
    await ImportLog.updateOne(
      { _id: log._id },
      {
        status: 'error',
        importErrors: [err instanceof Error ? err.message : 'Onbekende fout'],
        completedAt: new Date(),
      }
    )
    throw err
  }
}
