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

  const field = new URL(req.url).searchParams.get('field')
  if (!field) return NextResponse.json({ error: 'field verplicht' }, { status: 400 })

  const isStandard = STANDARD_FIELDS.includes(field)
  const mongoField = isStandard ? field : `attributes.${field}`

  const values = (await Product.distinct(mongoField, { [mongoField]: { $nin: [null, ''] } }) as unknown[])
    .map(v => String(v))
    .filter(Boolean)
    .sort()

  return NextResponse.json({ field, values, total: values.length })
}
