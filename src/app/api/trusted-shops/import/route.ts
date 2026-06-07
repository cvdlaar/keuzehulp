import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'
import Papa from 'papaparse'

// POST /api/trusted-shops/import
// Verwacht een multipart form met een CSV-bestand.
// CSV-formaat (header vereist): sku, rating, count
// Voorbeeld:
//   sku,rating,count
//   ABC123,4.5,23
//   DEF456,4.2,10

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Geen bestand meegestuurd.' }, { status: 400 })
  if (!file.name.endsWith('.csv')) return NextResponse.json({ error: 'Alleen CSV-bestanden toegestaan.' }, { status: 400 })

  const text = await file.text()

  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  if (errors.length && !data.length) {
    return NextResponse.json({ error: 'CSV kon niet worden geparsed.' }, { status: 400 })
  }

  // Controleer of de kolommen aanwezig zijn
  const firstRow = data[0] ?? {}
  if (!('sku' in firstRow)) {
    return NextResponse.json({ error: 'CSV mist verplichte kolom "sku".' }, { status: 400 })
  }

  await connectDB()

  let updated = 0
  let skipped = 0

  for (const row of data) {
    const sku = row.sku?.trim()
    const rating = parseFloat(row.rating ?? '')
    const count = parseInt(row.count ?? row.review_count ?? '', 10)

    if (!sku) { skipped++; continue }

    const setFields: Record<string, string> = {}
    if (!isNaN(rating)) setFields['attributes.ts_rating'] = String(rating)
    if (!isNaN(count)) setFields['attributes.ts_review_count'] = String(count)

    if (!Object.keys(setFields).length) { skipped++; continue }

    const res = await Product.updateOne({ sku }, { $set: setFields })
    if (res.matchedCount > 0) updated++
    else skipped++
  }

  return NextResponse.json({
    total: data.length,
    updated,
    skipped,
    message: `${updated} van ${data.length} producten bijgewerkt.`,
  })
}
