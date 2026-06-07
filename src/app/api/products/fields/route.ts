import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'

const STANDARD_FIELDS = [
  'category', 'brand', 'title', 'availability',
  'shortDescription', 'description', 'price', 'salePrice',
  'lowestPrice', 'sku', 'ean', 'qtyIncrement',
]

export async function GET(req: NextRequest) {
  await connectDB()

  const detail = new URL(req.url).searchParams.get('detail') === '1'
  const sample = await Product.find({}, { attributes: 1 }).limit(500).lean()

  const attrKeys = new Set<string>()
  const attrData: Record<string, { count: number; samples: Set<string> }> = {}

  for (const p of sample) {
    const attrs = p.attributes as Record<string, unknown> | undefined
    if (!attrs) continue
    for (const [key, val] of Object.entries(attrs)) {
      attrKeys.add(key)
      if (detail) {
        if (!attrData[key]) attrData[key] = { count: 0, samples: new Set() }
        attrData[key].count++
        if (val && attrData[key].samples.size < 3) attrData[key].samples.add(String(val))
      }
    }
  }

  const fields = [
    ...STANDARD_FIELDS,
    ...[...attrKeys].filter(k => !STANDARD_FIELDS.includes(k)).sort(),
  ]

  if (!detail) return NextResponse.json({ fields })

  const detailRows = [...attrKeys].sort().map(key => ({
    key,
    count: attrData[key]?.count ?? 0,
    sample: [...(attrData[key]?.samples ?? [])],
  }))

  return NextResponse.json({ fields, detail: detailRows })
}
