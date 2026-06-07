import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Event from '@/models/Event'
import Product from '@/models/Product'
import Flow from '@/models/Flow'
import MaatwerkSubmission from '@/models/MaatwerkSubmission'

export async function GET(req: NextRequest) {
  await connectDB()

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(Number(searchParams.get('days') || 30), 7), 90)

  const since = new Date(Date.now() - days * 86400_000)
  const since7d  = new Date(Date.now() -  7 * 86400_000)
  const since30d = new Date(Date.now() - 30 * 86400_000)

  const dailyAgg = (type: string) => Event.aggregate([
    { $match: { type, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $project: { _id: 0, date: '$_id', count: 1 } },
    { $sort: { date: 1 } },
  ])

  const [
    sessions30d,
    resultsShown30d,
    sessions7d,
    topShown,
    topClicked,
    flowCount,
    productCount,
    attrKeysResult,
    maatwerk30d,
    maatwerkShown30d,
    dailySessions,
    dailyResults,
    dailyClicks,
    dailyMaatwerk,
  ] = await Promise.all([
    Event.distinct('sessionId', { type: 'question_shown', createdAt: { $gte: since30d } }),
    Event.countDocuments({ type: 'results_shown', createdAt: { $gte: since30d } }),
    Event.distinct('sessionId', { type: 'question_shown', createdAt: { $gte: since7d } }),

    Product.find({ shownCount: { $gt: 0 } })
      .sort({ shownCount: -1 }).limit(10)
      .select('title brand shownCount clickCount imageLink').lean(),

    Product.find({ clickCount: { $gt: 0 } })
      .sort({ clickCount: -1 }).limit(10)
      .select('title brand shownCount clickCount imageLink').lean(),

    Flow.countDocuments({ active: true }),
    Product.countDocuments(),

    Product.aggregate([
      { $project: { keys: { $objectToArray: '$attributes' } } },
      { $unwind: '$keys' },
      { $group: { _id: '$keys.k' } },
      { $count: 'total' },
    ]),

    MaatwerkSubmission.countDocuments({ createdAt: { $gte: since30d } }),
    Event.countDocuments({ type: 'maatwerk_shown', createdAt: { $gte: since30d } }),

    // Dagelijkse unieke sessies
    Event.aggregate([
      { $match: { type: 'question_shown', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, sessions: { $addToSet: '$sessionId' } } },
      { $project: { _id: 0, date: '$_id', count: { $size: '$sessions' } } },
      { $sort: { date: 1 } },
    ]),

    dailyAgg('results_shown'),
    dailyAgg('product_click'),
    dailyAgg('maatwerk_shown'),
  ])

  // Vul alle datums in binnen het bereik, zodat elke serie even lang is
  const allDates: string[] = []
  for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().slice(0, 10))
  }

  const fill = (raw: { date: string; count: number }[]) => {
    const map = Object.fromEntries(raw.map(r => [r.date, r.count]))
    return allDates.map(date => ({ date, count: map[date] ?? 0 }))
  }

  const attributeCount: number = (attrKeysResult as Array<{ total: number }>)[0]?.total ?? 0

  return NextResponse.json({
    sessions30d: sessions30d.length,
    sessions7d:  sessions7d.length,
    resultsShown30d,
    maatwerk30d,
    maatwerkShown30d,
    flowCount,
    productCount,
    attributeCount,
    topShown,
    topClicked,
    dailySessions:  fill(dailySessions),
    dailyResults:   fill(dailyResults),
    dailyClicks:    fill(dailyClicks),
    dailyMaatwerk:  fill(dailyMaatwerk),
  })
}
