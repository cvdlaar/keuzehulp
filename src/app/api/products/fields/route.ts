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

  // Aggregation over ALL products — scans every attribute key with a non-empty value
  type AggRow = { _id: string; count: number; samples: string[] }
  const agg: AggRow[] = await Product.aggregate([
    { $project: { kvs: { $objectToArray: { $ifNull: ['$attributes', {}] } } } },
    { $unwind: '$kvs' },
    { $group: {
      _id: '$kvs.k',
      count: { $sum: { $cond: [{ $and: [{ $ne: ['$kvs.v', ''] }, { $ne: ['$kvs.v', null] }] }, 1, 0] } },
      samples: { $push: { $cond: [{ $and: [{ $ne: ['$kvs.v', ''] }, { $ne: ['$kvs.v', null] }] }, { $toString: '$kvs.v' }, '$$REMOVE'] } },
    } },
    { $match: { count: { $gt: 0 } } },
    { $project: { _id: 1, count: 1, samples: { $slice: ['$samples', 3] } } },
    { $sort: { _id: 1 } },
  ])

  const attrKeys = agg.map(r => r._id)

  const fields = [
    ...STANDARD_FIELDS,
    ...attrKeys.filter(k => !STANDARD_FIELDS.includes(k)).sort(),
  ]

  if (!detail) return NextResponse.json({ fields })

  const detailRows = agg.map(r => ({
    key: r._id,
    count: r.count,
    sample: r.samples,
  }))

  return NextResponse.json({ fields, detail: detailRows })
}
