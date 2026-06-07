import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Flow from '@/models/Flow'
import Product from '@/models/Product'
import { DEFAULT_BOOST } from '@/models/Flow'
import type { Answer, MatchRule, Question, BoostConfig } from '@/models/Flow'

type SelectedAnswers = Record<string, string | string[]>

interface RangeSelection {
  field: string
  unit: string
  userValue: number
  strictFilter: boolean
  questionId: string
}

export interface RuleResult {
  field: string
  operator: string
  value: string
  matched: boolean
  productValue: string
  answerId: string
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

// ── Velden die rechtstreeks op het product-document staan ───────────────────

const TOP_LEVEL_FIELDS = new Set([
  'category', 'brand', 'title', 'availability',
  'shortDescription', 'description', 'price', 'salePrice',
  'lowestPrice', 'sku', 'ean', 'externalId', 'link', 'imageLink',
])

function fieldToMongoPath(field: string): string {
  return TOP_LEVEL_FIELDS.has(field) ? field : `attributes.${field}`
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  const raw = getProductValue(product, rule.field)
  const val = raw.toLowerCase()
  const expected = rule.value.toLowerCase()
  switch (rule.operator) {
    case 'contains':    return val.includes(expected)
    case 'notContains': return !val.includes(expected)
    case 'equals':      return val === expected
    case 'notEquals':   return val !== expected
    case 'startsWith':  return val.startsWith(expected)
    case 'gt':  return parseFloat(raw) >  parseFloat(rule.value)
    case 'gte': return parseFloat(raw) >= parseFloat(rule.value)
    case 'lt':  return parseFloat(raw) <  parseFloat(rule.value)
    case 'lte': return parseFloat(raw) <= parseFloat(rule.value)
    default:    return false
  }
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreProduct(
  product: Record<string, unknown>,
  chosenAnswers: Answer[],
  boost: BoostConfig,
  allPrices: number[],
  allMargins: number[],
  rangeSelections: RangeSelection[] = [],
  rangeMaxDistances: number[] = []
): Omit<ScoredProduct, 'product'> {
  // 1. Regelresultaten (antwoord-gebaseerde regels)
  const ruleResults: RuleResult[] = []
  const searchCriteria: string[] = []

  for (const answer of chosenAnswers) {
    for (const rule of answer.matchRules) {
      const matched = evalRule(rule, product)
      const productValue = getProductValue(product, rule.field)
      ruleResults.push({ field: rule.field, operator: rule.operator, value: rule.value, matched, productValue, answerId: answer.id })

      const label = `${rule.field} ${rule.operator} "${rule.value}"`
      if (!searchCriteria.includes(label)) searchCriteria.push(label)
    }
  }

  // 2. Range virtuele regels (behandeld als matchregel ≥ gebruikersinvoer)
  for (const r of rangeSelections) {
    const productValue = parseFloat(getProductValue(product, r.field))
    const matched = !isNaN(productValue) && productValue >= r.userValue
    ruleResults.push({
      field: r.field,
      operator: 'gte',
      value: String(r.userValue),
      matched,
      productValue: isNaN(productValue) ? '' : String(productValue),
      answerId: r.questionId,
    })
    const unitStr = r.unit ? ` ${r.unit}` : ''
    const label = `${r.field} ≥ ${r.userValue}${unitStr}`
    if (!searchCriteria.includes(label)) searchCriteria.push(label)
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
  if (boost.priceBoost > 0 && boost.pricePreference !== 'none' && allPrices.length > 1) {
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

  // Range nabijheidsboost (max 50 punten per range-vraag voor dichtstbijzijnde product)
  for (let i = 0; i < rangeSelections.length; i++) {
    const r = rangeSelections[i]
    const maxDist = rangeMaxDistances[i]
    const productValue = parseFloat(getProductValue(product, r.field))
    if (isNaN(productValue) || productValue < r.userValue) continue
    const distance = productValue - r.userValue
    const pts = maxDist === 0 ? 50 : Math.round((1 - Math.min(distance / maxDist, 1)) * 50)
    if (pts > 0) {
      bonusScore += pts
      const unitStr = r.unit ? ` ${r.unit}` : ''
      boostBreakdown.push({ label: `${r.field} ≈ ${r.userValue}${unitStr} (${productValue})`, points: pts })
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
    if (!question || question.type === 'range') continue
    const ids = Array.isArray(answerIdOrIds) ? answerIdOrIds : [answerIdOrIds]
    for (const answerId of ids) {
      const answer = (question.answers as Answer[]).find(a => a.id === answerId)
      if (answer) chosenAnswers.push(answer)
    }
  }

  // Verzamel range-vragen
  const rangeSelections: RangeSelection[] = []
  for (const [questionId, value] of Object.entries(selectedAnswers)) {
    const question = (flow.questions as Question[]).find(q => q.id === questionId)
    if (!question || question.type !== 'range') continue
    const q = question as Question & { rangeField?: string; rangeUnit?: string; rangeStrictFilter?: boolean }
    if (!q.rangeField || typeof value !== 'string') continue
    const num = parseFloat(value)
    if (!isNaN(num)) {
      rangeSelections.push({
        field: q.rangeField,
        unit: q.rangeUnit ?? '',
        userValue: num,
        strictFilter: q.rangeStrictFilter ?? false,
        questionId,
      })
    }
  }

  // Verzamel kandidaat-producten
  const pinnedIds = [...new Set(chosenAnswers.flatMap(a => a.pinnedProductIds))]
  const ruleFilters = chosenAnswers
    .map(a => {
      if (!a.matchRules.length) return {}
      const conditions = a.matchRules.map(rule => {
        const f = fieldToMongoPath(rule.field)
        const v = rule.value
        const esc = escapeRegex(v)
        const num = parseFloat(v)
        switch (rule.operator) {
          case 'contains':    return { [f]: { $regex: esc, $options: 'i' } }
          case 'notContains': return { [f]: { $not: { $regex: esc, $options: 'i' } } }
          case 'equals':      return { [f]: v }
          case 'notEquals':   return { [f]: { $ne: v } }
          case 'startsWith':  return { [f]: { $regex: `^${esc}`, $options: 'i' } }
          case 'gt':          return { [f]: { $gt: num } }
          case 'gte':         return { [f]: { $gte: num } }
          case 'lt':          return { [f]: { $lt: num } }
          case 'lte':         return { [f]: { $lte: num } }
          default:            return {}
        }
      })
      return conditions.length === 1 ? conditions[0] : { $and: conditions }
    })
    .filter(f => Object.keys(f).length > 0)

  let rawProducts: Record<string, unknown>[] = []
  const hasRegularFilters = pinnedIds.length > 0 || ruleFilters.length > 0
  const hasRangeSelections = rangeSelections.length > 0

  if (hasRegularFilters) {
    const orClauses: Record<string, unknown>[] = []
    if (pinnedIds.length) orClauses.push({ _id: { $in: pinnedIds } })
    if (ruleFilters.length) orClauses.push(...ruleFilters)
    rawProducts = await Product.find({ $or: orClauses }).limit(500).lean() as Record<string, unknown>[]
  } else if (hasRangeSelections) {
    // Range-only vragen: haal alle producten op voor in-memory scoring
    rawProducts = await Product.find({}).limit(500).lean() as Record<string, unknown>[]
  }

  if (!rawProducts.length) {
    return NextResponse.json({ perfect: [], alternatives: [], searchCriteria: [] })
  }

  // Verzamel prijzen en marges voor normalisatie
  const allPrices = rawProducts.map(p => (p.salePrice as number) || (p.price as number) || 0)
  const allMargins = boost.marginField
    ? rawProducts.map(p => parseFloat(getProductValue(p, boost.marginField)) || 0)
    : []

  // Bereken maximale afstand per range-vraag voor normalisatie van de nabijheidsboost
  const rangeMaxDistances = rangeSelections.map(r => {
    const distances = rawProducts
      .map(p => parseFloat(getProductValue(p, r.field)))
      .filter(v => !isNaN(v) && v >= r.userValue)
      .map(v => v - r.userValue)
    return distances.length > 0 ? Math.max(0, ...distances) : 0
  })

  // Score elk product
  const scored: ScoredProduct[] = rawProducts.map(p => ({
    product: p,
    ...scoreProduct(p, chosenAnswers, boost, allPrices, allMargins, rangeSelections, rangeMaxDistances),
  }))

  // Sorteer op score
  scored.sort((a, b) => b.score - a.score)

  // Maximaal 5 resultaten totaal; alternatieven vullen op tot 5 als er weinig perfect matches zijn
  const perfect = scored.filter(s => s.isPerfect).slice(0, 5)
  const alternatives = scored.filter(s => !s.isPerfect).slice(0, 5 - perfect.length)
  const searchCriteria = scored[0]?.searchCriteria ?? []

  // ── Bijproducten ──────────────────────────────────────────────────────────
  const mainIds = new Set([...perfect, ...alternatives].map(s => String(s.product._id)))

  const relatedPinnedIds = [...new Set(chosenAnswers.flatMap(a => (a as Answer & { relatedPinnedIds?: string[] }).relatedPinnedIds ?? []))]
  const relatedRuleFilters = chosenAnswers
    .flatMap(a => ((a as Answer & { relatedRules?: Answer['matchRules'] }).relatedRules ?? []).map(rule => {
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
        default:            return null
      }
    }))
    .filter((f): f is NonNullable<typeof f> => f !== null && Object.keys(f as object).length > 0) as Record<string, unknown>[]

  let related: ScoredProduct[] = []
  if (relatedPinnedIds.length > 0 || relatedRuleFilters.length > 0) {
    const orClauses: Record<string, unknown>[] = []
    if (relatedPinnedIds.length) orClauses.push({ _id: { $in: relatedPinnedIds } })
    if (relatedRuleFilters.length) orClauses.push(...relatedRuleFilters)

    const relatedRaw = (await Product.find({ $or: orClauses }).limit(100).lean() as Record<string, unknown>[])
      .filter(p => !mainIds.has(String(p._id)))

    const relatedPrices = relatedRaw.map(p => (p.salePrice as number) || (p.price as number) || 0)
    related = relatedRaw
      .map(p => ({ product: p, ...scoreProduct(p, [], boost, relatedPrices, []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }

  return NextResponse.json({ perfect, alternatives, searchCriteria, related })
}
