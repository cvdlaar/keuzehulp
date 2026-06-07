import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'
import type { MatchRule } from '@/models/Flow'

type Ctx = { params: Promise<{ id: string }> }

const TOP_LEVEL_FIELDS = new Set([
  'category', 'brand', 'title', 'availability',
  'shortDescription', 'description', 'price', 'salePrice',
  'lowestPrice', 'sku', 'ean', 'qtyIncrement', 'externalId',
])

function fieldToMongoPath(field: string): string {
  return TOP_LEVEL_FIELDS.has(field) ? field : `attributes.${field}`
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rulesToQuery(rules: MatchRule[]): Record<string, unknown> {
  if (!rules.length) return {}
  const conditions = rules.map(rule => {
    const f = fieldToMongoPath(rule.field)
    const esc = escapeRegex(rule.value)
    const num = parseFloat(rule.value)
    switch (rule.operator) {
      case 'contains':    return { [f]: { $regex: esc, $options: 'i' } }
      case 'notContains': return { [f]: { $not: { $regex: esc, $options: 'i' } } }
      case 'equals':      return { [f]: rule.value }
      case 'notEquals':   return { [f]: { $ne: rule.value } }
      case 'startsWith':  return { [f]: { $regex: `^${esc}`, $options: 'i' } }
      case 'gt':          return { [f]: { $gt: num } }
      case 'gte':         return { [f]: { $gte: num } }
      case 'lt':          return { [f]: { $lt: num } }
      case 'lte':         return { [f]: { $lte: num } }
      default:            return {}
    }
  }).filter(c => Object.keys(c).length > 0)
  return conditions.length === 1 ? conditions[0] : { $and: conditions }
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  await connectDB()
  await params // satisfy Next.js param resolution

  const { matchRules = [], pinnedProductIds = [] }: {
    matchRules: MatchRule[]
    pinnedProductIds: string[]
  } = await _req.json()

  const orClauses: Record<string, unknown>[] = []
  if (pinnedProductIds.length) orClauses.push({ _id: { $in: pinnedProductIds } })
  const ruleQuery = rulesToQuery(matchRules)
  if (Object.keys(ruleQuery).length) orClauses.push(ruleQuery)

  if (!orClauses.length) return NextResponse.json({ count: 0 })

  const count = await Product.countDocuments({ $or: orClauses })
  return NextResponse.json({ count })
}
