import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Event from '@/models/Event'
import Product from '@/models/Product'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { flowId, sessionId, type, data } = body

  if (!flowId || !sessionId || !type) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await connectDB()

  // Sla event op
  await Event.create({ flowId, sessionId, type, data: data ?? {} })

  // Directe counters bijwerken op het product-document
  const productId = data?.productId as string | undefined
  if (productId) {
    if (type === 'product_shown') {
      await Product.findByIdAndUpdate(productId, { $inc: { shownCount: 1 } }).catch(() => {})
    } else if (type === 'product_click') {
      await Product.findByIdAndUpdate(productId, { $inc: { clickCount: 1 } }).catch(() => {})
    } else if (type === 'add_to_cart') {
      await Product.findByIdAndUpdate(productId, { $inc: { cartCount: 1 } }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
