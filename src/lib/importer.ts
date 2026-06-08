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

// Haalt een bruikbare string op uit een waarde die door de XML-parser kan zijn omgezet
// naar een object (element met attributen) of array (herhaald element).
function extractString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (Array.isArray(val)) {
    // Herhaald XML-element → eerste bruikbare waarde
    for (const item of val) {
      const s = extractString(item)
      if (s) return s
    }
    return ''
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    // XML-element met zowel attributen als tekst: { _attr: "...", "#text": "waarde" }
    if ('#text' in obj) return String(obj['#text'])
    // Atom <link href="..."> element
    if ('_href' in obj) return String(obj['_href'])
    // Genest element zonder #text — probeer de eerste niet-attribuut waarde recursief
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue
      const s = extractString(v)
      if (s) return s
    }
  }
  return ''
}

export interface MappingDiagnostic {
  internalField: string
  feedKey: string
  found: boolean
  sample: string
}

function applyMapping(raw: AnyRecord, mapping: FieldMapping, attributeMapping: Record<string, string> = {}): ParsedProduct {
  const get = (field: string): string => {
    if (!field) return ''
    return extractString(raw[field])
  }

  const attributes: Record<string, string> = {}
  const mappedValues = new Set([
    ...Object.values(mapping).filter(Boolean),
    ...Object.values(attributeMapping).filter(Boolean),
  ])

  for (const [k, v] of Object.entries(raw)) {
    if (mappedValues.has(k)) continue

    const s = extractString(v)
    if (s || (v !== null && v !== undefined && typeof v !== 'object')) {
      attributes[k] = s
    } else if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      // Genest XML-object (bijv. <g:shipping> met sub-elementen) — één niveau platslaan.
      // XML-attributen hebben een '_' prefix en worden overgeslagen.
      for (const [subK, subV] of Object.entries(v as AnyRecord)) {
        if (subK.startsWith('_') || subK === '#text') continue
        const sv = extractString(subV)
        if (sv) attributes[`${k}_${subK}`] = sv
      }
    }
  }

  for (const [attrName, feedKey] of Object.entries(attributeMapping)) {
    if (!feedKey) continue
    const s = extractString(raw[feedKey])
    if (s) attributes[attrName] = s
  }

  return {
    externalId: get(mapping.externalId),
    title: get(mapping.title),
    description: get(mapping.description),
    shortDescription: get(mapping.shortDescription),
    link: get(mapping.link),
    imageLink: get(mapping.imageLink),
    price: parsePrice(extractString(raw[mapping.price]) || undefined),
    salePrice: mapping.salePrice && raw[mapping.salePrice] ? parsePrice(extractString(raw[mapping.salePrice]) || undefined) : null,
    lowestPrice: mapping.lowestPrice && raw[mapping.lowestPrice] ? parsePrice(extractString(raw[mapping.lowestPrice]) || undefined) : null,
    availability: get(mapping.availability),
    brand: get(mapping.brand),
    ean: get(mapping.ean),
    sku: get(mapping.sku),
    category: get(mapping.category),
    qtyIncrement: mapping.qtyIncrement && raw[mapping.qtyIncrement]
      ? parseInt(extractString(raw[mapping.qtyIncrement]) || '1') || 1
      : 1,
    attributes,
  }
}

function buildDiagnostics(rawItems: AnyRecord[], mapping: FieldMapping): { diagnostics: MappingDiagnostic[]; rawKeys: string[]; attributeSample: Record<string, string> } {
  const firstRaw = rawItems[0] ?? {}

  const diagnostics: MappingDiagnostic[] = (Object.entries(mapping) as [string, string][])
    .filter(([, feedKey]) => feedKey)
    .map(([internalField, feedKey]) => {
      const val = firstRaw[feedKey]
      const sample = extractString(val).slice(0, 80)
      return { internalField, feedKey, found: val !== undefined, sample }
    })

  const mappedValues = new Set(Object.values(mapping).filter(Boolean))
  const attributeSample: Record<string, string> = {}

  // Pass 1: collect all unmapped keys that appear anywhere in the feed
  for (const raw of rawItems) {
    for (const [k] of Object.entries(raw)) {
      if (!mappedValues.has(k) && !(k in attributeSample)) {
        attributeSample[k] = ''
      }
    }
    // Stop early once we have a non-empty sample for every key found so far
    if (Object.keys(attributeSample).length > 0 &&
        Object.values(attributeSample).every(v => v !== '')) break
  }

  // Pass 2: for keys still empty, scan until we find a non-empty extracted value OR a non-trivial raw value
  const needsSample = Object.keys(attributeSample).filter(k => attributeSample[k] === '')
  if (needsSample.length > 0) {
    for (const raw of rawItems) {
      for (const key of needsSample) {
        if (attributeSample[key] === '') {
          const v = raw[key]
          const s = extractString(v).slice(0, 80)
          if (s) {
            attributeSample[key] = s
          } else if (v !== null && v !== undefined && v !== '') {
            // Value exists but extractString can't read it — show raw JSON so the structure is visible
            attributeSample[key] = `[raw: ${JSON.stringify(v).slice(0, 60)}]`
          }
        }
      }
      if (needsSample.every(k => attributeSample[k] !== '')) break
    }
  }

  return { diagnostics, rawKeys: Object.keys(firstRaw), attributeSample }
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

async function executeImport(feedConfigId: string, logId: string): Promise<void> {
  await connectDB()

  const config = await FeedConfig.findById(feedConfigId)
  if (!config) throw new Error('Feed configuratie niet gevonden')

  const stored = (config.fieldMapping ?? {}) as Record<string, string>
  const mapping = { ...DEFAULT_MAPPING } as unknown as Record<string, string>
  for (const [k, v] of Object.entries(stored)) {
    if (v !== '') mapping[k] = v
  }
  const typedMapping = mapping as unknown as FieldMapping
  const attributeMapping = (config.attributeMapping ?? {}) as Record<string, string>

  try {
    const response = await axios.get<string>(config.url, {
      responseType: 'text',
      timeout: 60000,
      headers: { 'Accept-Encoding': 'gzip' },
    })

    const rawItems = config.format === 'csv'
      ? extractCSVItems(response.data)
      : extractXMLItems(response.data)

    const products = rawItems.map((item) => applyMapping(item, typedMapping, attributeMapping))

    const { diagnostics: mappingDiagnostics, rawKeys, attributeSample } = rawItems.length > 0
      ? buildDiagnostics(rawItems, typedMapping)
      : { diagnostics: [], rawKeys: [], attributeSample: {} }

    // Totaal bekend + diagnostics — direct in het log zetten zodat voortgangsbalk werkt
    await ImportLog.updateOne({ _id: logId }, { totalInFeed: rawItems.length, mappingDiagnostics, rawKeys, attributeSample })

    let imported = 0
    let updated = 0
    let skipped = 0
    const importErrors: string[] = []

    const validProducts = products.filter(p => p.externalId)
    skipped = products.length - validProducts.length

    const BATCH_SIZE = 500
    for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
      const batch = validProducts.slice(i, i + BATCH_SIZE)

      const ops = batch.map(p => ({
        updateOne: {
          filter: { externalId: p.externalId },
          update: { $set: p },
          upsert: true,
        },
      }))

      try {
        const result = await Product.bulkWrite(ops, { ordered: false })
        imported += result.upsertedCount
        updated += result.matchedCount
      } catch (e) {
        // ordered: false — gedeeltelijk success is mogelijk; haal tellingen op uit de error
        const bulkErr = e as { result?: { upsertedCount?: number; matchedCount?: number }; writeErrors?: Array<{ errmsg?: string }> }
        imported += bulkErr.result?.upsertedCount ?? 0
        updated += bulkErr.result?.matchedCount ?? 0
        const msgs = bulkErr.writeErrors?.map(we => we.errmsg ?? 'write error') ?? [`${e instanceof Error ? e.message : 'onbekende fout'}`]
        importErrors.push(...msgs.slice(0, 5))
      }

      // Voortgang na elke batch bijwerken
      await ImportLog.updateOne({ _id: logId }, { imported, updated, skipped })

      // Annulering controleren
      const current = await ImportLog.findById(logId, { cancelRequested: 1 }).lean()
      if (current?.cancelRequested) {
        await ImportLog.updateOne({ _id: logId }, { status: 'cancelled', completedAt: new Date() })
        return
      }
    }

    await ImportLog.updateOne(
      { _id: logId },
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
  } catch (err) {
    await ImportLog.updateOne(
      { _id: logId },
      {
        status: 'error',
        importErrors: [err instanceof Error ? err.message : 'Onbekende fout'],
        completedAt: new Date(),
      }
    )
  }
}

export async function startImport(feedConfigId: string): Promise<string> {
  await connectDB()

  const config = await FeedConfig.findById(feedConfigId)
  if (!config) throw new Error('Feed configuratie niet gevonden')

  const log = await ImportLog.create({
    feedConfigId: config._id,
    feedName: config.name,
    status: 'running',
    startedAt: new Date(),
  })

  const logId = String(log._id)

  // Op de achtergrond uitvoeren — blokkeert de HTTP response niet
  void executeImport(feedConfigId, logId)

  return logId
}

// Achterwaartse compatibiliteit voor bestaande aanroepen (cron etc.)
export async function runImport(feedConfigId: string): Promise<string> {
  await connectDB()

  const config = await FeedConfig.findById(feedConfigId)
  if (!config) throw new Error('Feed configuratie niet gevonden')

  const log = await ImportLog.create({
    feedConfigId: config._id,
    feedName: config.name,
    status: 'running',
    startedAt: new Date(),
  })

  const logId = String(log._id)
  await executeImport(feedConfigId, logId)
  return logId
}
