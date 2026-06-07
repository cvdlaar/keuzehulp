import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  const body = await req.json()

  const product = await Product.findById(id)
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.attributes !== undefined) {
    product.set('attributes', body.attributes)
    product.markModified('attributes')
  }

  await product.save()
  return NextResponse.json({ ok: true })
}
