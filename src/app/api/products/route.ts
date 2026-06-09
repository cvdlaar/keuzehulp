import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'

export async function GET(req: NextRequest) {
  await connectDB()

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const availability = searchParams.get('availability') || ''

  const query: Record<string, unknown> = {}

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
      { externalId: { $regex: search, $options: 'i' } },
      { ean: { $regex: search, $options: 'i' } },
    ]
  }

  if (category) query.category = { $regex: category, $options: 'i' }
  if (availability === 'in_stock') {
    query.availability = { $in: ['in_stock', 'in stock', 'op voorraad'] }
  } else if (availability === 'out_of_stock') {
    query.availability = { $in: ['out_of_stock', 'out of stock', 'niet op voorraad'] }
  } else if (availability) {
    query.availability = availability
  }

  const skip = (page - 1) * limit
  const [products, total] = await Promise.all([
    Product.find(query).skip(skip).limit(limit).lean(),
    Product.countDocuments(query),
  ])

  return NextResponse.json({
    products,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}

export async function DELETE(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    await Product.findByIdAndDelete(id)
  } else {
    await Product.deleteMany({})
  }

  return NextResponse.json({ success: true })
}
