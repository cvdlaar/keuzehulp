import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Event from '@/models/Event'
import MaatwerkSubmission from '@/models/MaatwerkSubmission'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id: flowId } = await params
  const { searchParams } = new URL(req.url)

  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  const dateFilter: Record<string, unknown> = {}
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.$gte = new Date(from)
    if (to)   range.$lte = new Date(to)
    dateFilter.createdAt = range
  }

  const base = { flowId, ...dateFilter }

  const dailyEventAgg = (type: string | string[]) => {
    const typeMatch = Array.isArray(type) ? { $in: type } : type
    return Event.aggregate([
      { $match: { ...base, type: typeMatch } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } },
    ])
  }

  const [sessions, byType, byQuestion, byAnswer, byProduct, byShown, rawSessions, rawResults, rawClicks, rawMaatwerkShown, maatwerkShownCount, maatwerkCount] = await Promise.all([
    Event.distinct('sessionId', base),

    Event.aggregate([
      { $match: base },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),

    Event.aggregate([
      { $match: { ...base, type: 'question_shown' } },
      { $group: { _id: '$data.questionId', text: { $first: '$data.questionText' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Event.aggregate([
      { $match: { ...base, type: 'answer_selected' } },
      {
        $group: {
          _id: { questionId: '$data.questionId', answerId: '$data.answerId' },
          questionText: { $first: '$data.questionText' },
          answerText: { $first: '$data.answerText' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),

    Event.aggregate([
      { $match: { ...base, type: { $in: ['product_click', 'add_to_cart'] } } },
      {
        $group: {
          _id: { type: '$type', productId: '$data.productId' },
          title: { $first: '$data.productTitle' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),

    Event.aggregate([
      { $match: { ...base, type: 'product_shown' } },
      {
        $group: {
          _id: '$data.productId',
          title: { $first: '$data.productTitle' },
          shown: { $sum: 1 },
          perfectShown: { $sum: { $cond: [{ $eq: ['$data.isPerfect', 1] }, 1, 0] } },
        },
      },
      { $sort: { shown: -1 } },
      { $limit: 15 },
    ]),

    // Dagelijkse unieke sessies
    Event.aggregate([
      { $match: { ...base, type: 'question_shown' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sessions: { $addToSet: '$sessionId' },
        },
      },
      { $project: { _id: 0, date: '$_id', count: { $size: '$sessions' } } },
      { $sort: { date: 1 } },
    ]),

    dailyEventAgg('results_shown'),
    dailyEventAgg('product_click'),
    dailyEventAgg('maatwerk_shown'),

    Event.countDocuments({ ...base, type: 'maatwerk_shown' }),
    MaatwerkSubmission.countDocuments({ flowId, ...dateFilter }),
  ])

  // Bepaal datumbereik voor fill
  const fromDate = from ? new Date(from) : (() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d
  })()
  const toDate = to ? new Date(to) : new Date()

  const allDates: string[] = []
  for (const d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().slice(0, 10))
  }

  const fill = (raw: { date: string; count: number }[]) => {
    const map = Object.fromEntries(raw.map(r => [r.date, r.count]))
    return allDates.map(date => ({ date, count: map[date] ?? 0 }))
  }

  const typeMap: Record<string, number> = {}
  for (const t of byType) typeMap[t._id] = t.count

  const totalSessions = sessions.length
  const completions = typeMap['results_shown'] ?? 0
  const noResults   = typeMap['no_results'] ?? 0

  const questionMap: Record<string, { text: string; impressions: number; answers: { id: string; text: string; count: number }[] }> = {}
  for (const q of byQuestion) {
    questionMap[q._id] = { text: String(q.text ?? q._id), impressions: q.count, answers: [] }
  }
  for (const a of byAnswer) {
    const qId = a._id.questionId
    if (!questionMap[qId]) questionMap[qId] = { text: String(a.questionText ?? qId), impressions: 0, answers: [] }
    questionMap[qId].answers.push({ id: a._id.answerId, text: String(a.answerText ?? a._id.answerId), count: a.count })
  }

  const productClicks: { productId: string; title: string; count: number }[] = []
  const addToCarts:    { productId: string; title: string; count: number }[] = []
  for (const p of byProduct) {
    const entry = { productId: String(p._id.productId), title: String(p.title ?? p._id.productId), count: p.count }
    if (p._id.type === 'product_click') productClicks.push(entry)
    else addToCarts.push(entry)
  }

  const recommendedProducts = (byShown as { _id: string; title: string; shown: number; perfectShown: number }[])
    .map(p => ({ productId: String(p._id), title: String(p.title ?? p._id), shown: p.shown, perfectShown: p.perfectShown }))

  return NextResponse.json({
    totalSessions,
    completions,
    noResults,
    maatwerkCount,
    completionRate:  totalSessions > 0 ? Math.round((completions / totalSessions) * 100) : 0,
    noResultsRate:   totalSessions > 0 ? Math.round((noResults   / totalSessions) * 100) : 0,
    questions:       Object.values(questionMap),
    recommendedProducts,
    productClicks:   productClicks.slice(0, 10),
    addToCarts:      addToCarts.slice(0, 10),
    maatwerkShownCount,
    dailySessions:   fill(rawSessions       as { date: string; count: number }[]),
    dailyResults:    fill(rawResults        as { date: string; count: number }[]),
    dailyClicks:     fill(rawClicks         as { date: string; count: number }[]),
    dailyMaatwerk:   fill(rawMaatwerkShown  as { date: string; count: number }[]),
  })
}
