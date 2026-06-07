import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'
import Flow from '@/models/Flow'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params

  const product = await Product.findById(id).lean()
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const productIdStr = (product._id as { toString(): string }).toString()

  const flows = await Flow.find(
    { 'questions.answers.pinnedProductIds': productIdStr },
    { _id: 1, name: 1 }
  ).lean()

  return NextResponse.json({
    product,
    stats: {
      shown:     (product as { shownCount?: number }).shownCount ?? 0,
      clicks:    (product as { clickCount?: number }).clickCount ?? 0,
      addToCarts: (product as { cartCount?: number }).cartCount ?? 0,
    },
    flows: flows.map((f) => ({
      id: (f._id as { toString(): string }).toString(),
      name: f.name,
    })),
  })
}
