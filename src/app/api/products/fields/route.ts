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

  // Aggregation over standard (top-level) fields
  const stdAgg: AggRow[] = await Product.aggregate([
    {
      $project: STANDARD_FIELDS.reduce((acc, f) => ({ ...acc, [f]: 1 }), {} as Record<string, number>)
    },
    {
      $project: {
        pairs: {
          $filter: {
            input: { $objectToArray: '$$ROOT' },
            as: 'p',
            cond: {
              $and: [
                { $ne: ['$$p.k', '_id'] },
                { $ne: ['$$p.v', null] },
                { $ne: [{ $toString: '$$p.v' }, ''] },
              ]
            }
          }
        }
      }
    },
    { $unwind: '$pairs' },
    {
      $group: {
        _id: '$pairs.k',
        count: { $sum: 1 },
        samples: { $push: { $substr: [{ $toString: '$pairs.v' }, 0, 80] } }
      }
    },
    { $match: { count: { $gt: 0 } } },
    { $project: { _id: 1, count: 1, samples: { $slice: ['$samples', 3] } } },
  ])

  const stdDetailMap = new Map(stdAgg.map(r => [r._id, r]))

  // Standard fields first (in STANDARD_FIELDS order), then dynamic attributes
  const detailRows = [
    ...STANDARD_FIELDS
      .map(f => {
        const r = stdDetailMap.get(f)
        return r ? { key: r._id, count: r.count, sample: r.samples } : null
      })
      .filter(Boolean),
    ...agg
      .filter(r => !STANDARD_FIELDS.includes(r._id))
      .map(r => ({ key: r._id, count: r.count, sample: r.samples })),
  ]

  return NextResponse.json({ fields, detail: detailRows })
}
