import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Event from '@/models/Event'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id: flowId } = await params

  const [sessions, byType, byQuestion, byAnswer, byProduct] = await Promise.all([
    // Unieke sessies
    Event.distinct('sessionId', { flowId }),

    // Totaal per type
    Event.aggregate([
      { $match: { flowId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),

    // Vraagweergaven per questionId
    Event.aggregate([
      { $match: { flowId, type: 'question_shown' } },
      { $group: { _id: '$data.questionId', text: { $first: '$data.questionText' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Antwoordklikken per questionId + answerId
    Event.aggregate([
      { $match: { flowId, type: 'answer_selected' } },
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

    // Product klikken + add_to_cart
    Event.aggregate([
      { $match: { flowId, type: { $in: ['product_click', 'add_to_cart'] } } },
      {
        $group: {
          _id: { type: '$type', productId: '$data.productId' },
          title: { $first: '$data.productTitle' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ])

  const typeMap: Record<string, number> = {}
  for (const t of byType) typeMap[t._id] = t.count

  const totalSessions = sessions.length
  const completions = typeMap['results_shown'] ?? 0
  const noResults = typeMap['no_results'] ?? 0

  // Groepeer antwoorden per vraag
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
  const addToCarts: { productId: string; title: string; count: number }[] = []
  for (const p of byProduct) {
    const entry = { productId: String(p._id.productId), title: String(p.title ?? p._id.productId), count: p.count }
    if (p._id.type === 'product_click') productClicks.push(entry)
    else addToCarts.push(entry)
  }

  return NextResponse.json({
    totalSessions,
    completions,
    noResults,
    completionRate: totalSessions > 0 ? Math.round((completions / totalSessions) * 100) : 0,
    noResultsRate: totalSessions > 0 ? Math.round((noResults / totalSessions) * 100) : 0,
    questions: Object.values(questionMap),
    productClicks: productClicks.slice(0, 10),
    addToCarts: addToCarts.slice(0, 10),
  })
}
