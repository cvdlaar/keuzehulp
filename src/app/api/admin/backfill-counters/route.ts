import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Event from '@/models/Event'
import Product from '@/models/Product'
import { getSession } from '@/lib/auth'

export async function POST() {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })

  await connectDB()

  // Aggregeer event-counts per productId per type
  const agg = await Event.aggregate([
    {
      $match: {
        type: { $in: ['product_shown', 'product_click', 'add_to_cart'] },
        'data.productId': { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: { productId: '$data.productId', type: '$type' },
        count: { $sum: 1 },
      },
    },
  ])

  // Groepeer per productId
  const counters: Record<string, { shown: number; click: number; cart: number }> = {}
  for (const row of agg) {
    const pid = String(row._id.productId)
    if (!counters[pid]) counters[pid] = { shown: 0, click: 0, cart: 0 }
    if (row._id.type === 'product_shown') counters[pid].shown += row.count
    if (row._id.type === 'product_click') counters[pid].click += row.count
    if (row._id.type === 'add_to_cart')  counters[pid].cart  += row.count
  }

  // Update alle producten in één bulkWrite
  const ops = Object.entries(counters).map(([id, c]) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { shownCount: c.shown, clickCount: c.click, cartCount: c.cart } },
    },
  }))

  let updated = 0
  if (ops.length > 0) {
    const result = await Product.bulkWrite(ops, { ordered: false })
    updated = result.modifiedCount
  }

  return NextResponse.json({ ok: true, productsUpdated: updated, uniqueProducts: ops.length })
}
