import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Flow from '@/models/Flow'
import Product from '@/models/Product'
import { DEFAULT_BOOST } from '@/models/Flow'
import type { Answer, MatchRule, Question, BoostConfig } from '@/models/Flow'

type SelectedAnswers = Record<string, string | string[]>

export interface RuleResult {
  field: string
  operator: string
  value: string
  matched: boolean
  productValue: string
}

export interface ScoredProduct {
  product: Record<string, unknown>
  score: number
  isPerfect: boolean
  matchedRules: number
  totalRules: number
  ruleResults: RuleResult[]
  boostBreakdown: { label: string; points: number }[]
  searchCriteria: string[]
}

// ── Regel evaluatie ──────────────────────────────────────────────────────────

function getProductValue(product: Record<string, unknown>, field: string): string {
  const direct = product[field]
  if (direct !== undefined && direct !== null) return String(direct)
  const attrs = product.attributes as Record<string, string> | undefined
  if (attrs?.[field]) return attrs[field]
  return ''
}

function evalRule(rule: MatchRule, product: Record<string, unknown>): boolean {
  const val = getProductValue(product, rule.field).toLowerCase()
  const expected = rule.value.toLowerCase()
  switch (rule.operator) {
    case 'contains':    return val.includes(expected)
    case 'notContains': return !val.includes(expected)
    case 'equals':      return val === expected
    case 'startsWith':  return val.startsWith(expected)
    default:            return false
  }
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreProduct(
  product: Record<string, unknown>,
  chosenAnswers: Answer[],
  boost: BoostConfig,
  allPrices: number[],
  allMargins: number[]
): Omit<ScoredProduct, 'product'> {
  // 1. Regelresultaten
  const ruleResults: RuleResult[] = []
  const searchCriteria: string[] = []

  for (const answer of chosenAnswers) {
    for (const rule of answer.matchRules) {
      const matched = evalRule(rule, product)
      const productValue = getProductValue(product, rule.field)
      ruleResults.push({ field: rule.field, operator: rule.operator, value: rule.value, matched, productValue })

      const label = `${rule.field} ${rule.operator} "${rule.value}"`
      if (!searchCriteria.includes(label)) searchCriteria.push(label)
    }
  }

  const totalRules = ruleResults.length
  const matchedRules = ruleResults.filter(r => r.matched).length
  const isPerfect = totalRules === 0 || matchedRules === totalRules
  const baseScore = totalRules === 0 ? 100 : Math.round((matchedRules / totalRules) * 100)

  // 2. Boosts
  const boostBreakdown: { label: string; points: number }[] = []
  let bonusScore = 0

  // Beschikbaarheidsboost
  if (boost.availabilityBoost > 0) {
    const avail = getProductValue(product, 'availability').toLowerCase()
    if (avail === 'in stock' || avail === 'op voorraad') {
      bonusScore += boost.availabilityBoost
      boostBreakdown.push({ label: 'Op voorraad', points: boost.availabilityBoost })
    }
  }

  // Prijsboost
  if (boost.priceBoost > 0 && allPrices.length > 1) {
    const price = (product.price as number) || (product.salePrice as number) || 0
    const minP = Math.min(...allPrices)
    const maxP = Math.max(...allPrices)
    const range = maxP - minP
    if (range > 0) {
      const normalized = boost.pricePreference === 'cheapest'
        ? 1 - (price - minP) / range
        : (price - minP) / range
      const pts = Math.round(normalized * boost.priceBoost)
      if (pts > 0) {
        bonusScore += pts
        boostBreakdown.push({
          label: boost.pricePreference === 'cheapest' ? 'Goedkoopste' : 'Duurste',
          points: pts,
        })
      }
    }
  }

  // Margeboost
  if (boost.marginBoost > 0 && boost.marginField && allMargins.length > 1) {
    const margin = parseFloat(getProductValue(product, boost.marginField)) || 0
    const minM = Math.min(...allMargins)
    const maxM = Math.max(...allMargins)
    const range = maxM - minM
    if (range > 0) {
      const pts = Math.round(((margin - minM) / range) * boost.marginBoost)
      if (pts > 0) {
        bonusScore += pts
        boostBreakdown.push({ label: 'Marge', points: pts })
      }
    }
  }

  // SKU-boost
  if (boost.skuBoosts?.length) {
    const productSku = getProductValue(product, 'sku').toLowerCase()
    for (const entry of boost.skuBoosts) {
      if (entry.sku && productSku === entry.sku.toLowerCase()) {
        bonusScore += entry.points
        boostBreakdown.push({ label: `SKU ${entry.sku}`, points: entry.points })
        break
      }
    }
  }

  return {
    score: baseScore + bonusScore,
    isPerfect,
    matchedRules,
    totalRules,
    ruleResults,
    boostBreakdown,
    searchCriteria,
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext<'/api/flows/[id]/match'>) {
  await connectDB()
  const { id } = await ctx.params
  const { selectedAnswers } = (await req.json()) as { selectedAnswers: SelectedAnswers }

  const flow = await Flow.findById(id).lean()
  if (!flow) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const boost: BoostConfig = { ...DEFAULT_BOOST, ...(flow.boostConfig ?? {}) }

  // Verzamel geselecteerde antwoorden
  const chosenAnswers: Answer[] = []
  for (const [questionId, answerIdOrIds] of Object.entries(selectedAnswers)) {
    const question = (flow.questions as Question[]).find(q => q.id === questionId)
    if (!question) continue
    const ids = Array.isArray(answerIdOrIds) ? answerIdOrIds : [answerIdOrIds]
    for (const answerId of ids) {
      const answer = (question.answers as Answer[]).find(a => a.id === answerId)
      if (answer) chosenAnswers.push(answer)
    }
  }

  // Verzamel kandidaat-producten
  const pinnedIds = [...new Set(chosenAnswers.flatMap(a => a.pinnedProductIds))]
  const ruleFilters = chosenAnswers
    .map(a => {
      if (!a.matchRules.length) return {}
      const conditions = a.matchRules.map(rule => {
        const opMap = {
          contains: (f: string, v: string) => ({ [f]: { $regex: v, $options: 'i' } }),
          notContains: (f: string, v: string) => ({ [f]: { $not: { $regex: v, $options: 'i' } } }),
          equals: (f: string, v: string) => ({ [f]: v }),
          startsWith: (f: string, v: string) => ({ [f]: { $regex: `^${v}`, $options: 'i' } }),
        }
        return opMap[rule.operator](rule.field, rule.value)
      })
      return conditions.length === 1 ? conditions[0] : { $and: conditions }
    })
    .filter(f => Object.keys(f).length > 0)

  let rawProducts: Record<string, unknown>[] = []
  if (pinnedIds.length > 0 || ruleFilters.length > 0) {
    const orClauses: Record<string, unknown>[] = []
    if (pinnedIds.length) orClauses.push({ _id: { $in: pinnedIds } })
    if (ruleFilters.length) orClauses.push(...ruleFilters)
    rawProducts = await Product.find({ $or: orClauses }).limit(50).lean() as Record<string, unknown>[]
  }

  if (!rawProducts.length) {
    return NextResponse.json({ perfect: [], alternatives: [], searchCriteria: [] })
  }

  // Verzamel prijzen en marges voor normalisatie
  const allPrices = rawProducts.map(p => (p.salePrice as number) || (p.price as number) || 0)
  const allMargins = boost.marginField
    ? rawProducts.map(p => parseFloat(getProductValue(p, boost.marginField)) || 0)
    : []

  // Score elk product
  const scored: ScoredProduct[] = rawProducts.map(p => ({
    product: p,
    ...scoreProduct(p, chosenAnswers, boost, allPrices, allMargins),
  }))

  // Sorteer op score
  scored.sort((a, b) => b.score - a.score)

  // Maximaal 5 resultaten totaal; alternatieven vullen op tot 5 als er weinig perfect matches zijn
  const perfect = scored.filter(s => s.isPerfect).slice(0, 5)
  const alternatives = scored.filter(s => !s.isPerfect).slice(0, 5 - perfect.length)
  const searchCriteria = scored[0]?.searchCriteria ?? []

  return NextResponse.json({ perfect, alternatives, searchCriteria })
}
