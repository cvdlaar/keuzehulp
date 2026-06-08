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

  // Aggregation over dynamic attributes in product.attributes
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

  // Aggregation over standard (top-level) fields via $facet
  type FacetRow = { count: number; samples: string[] }
  type FacetResult = Record<string, FacetRow[]>

  let stdDetailRows: { key: string; count: number; sample: string[] }[] = []
  try {
    const facetStages: Record<string, object[]> = {}
    for (const field of STANDARD_FIELDS) {
      facetStages[field] = [
        { $match: { [field]: { $nin: [null, ''] } } },
        { $group: { _id: null, count: { $sum: 1 }, samples: { $push: { $toString: `$${field}` } } } },
        { $project: { _id: 0, count: 1, samples: { $slice: ['$samples', 3] } } },
      ]
    }
    const [facetResult] = await Product.aggregate<FacetResult>([{ $facet: facetStages }])
    stdDetailRows = STANDARD_FIELDS
      .map(f => {
        const rows = facetResult?.[f] ?? []
        if (rows.length === 0) return null
        return { key: f, count: rows[0].count, sample: rows[0].samples }
      })
      .filter((r): r is { key: string; count: number; sample: string[] } => r !== null)
  } catch {
    // Als de aggregatie faalt, standaardvelden weglaten uit detail
  }

  const detailRows = [
    ...stdDetailRows,
    ...agg
      .filter(r => !STANDARD_FIELDS.includes(r._id))
      .map(r => ({ key: r._id, count: r.count, sample: r.samples })),
  ]

  return NextResponse.json({ fields, detail: detailRows })
}
