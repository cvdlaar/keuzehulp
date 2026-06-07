import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'
import { getSettingOrEnv } from '@/lib/settings'

const TS_BASE = 'https://cdn1.api.trustedshops.com'

async function fetchTsRating(tsId: string, ean: string): Promise<{ rating: number | null; count: number | null }> {
  try {
    const url = `${TS_BASE}/shops/${tsId}/v2/reviews/products/${encodeURIComponent(ean)}.json`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { rating: null, count: null }
    const data = await res.json() as Record<string, Record<string, unknown>>
    const reviews = data.response?.data as Record<string, unknown> | undefined
    const rating = typeof reviews?.overallMark === 'number' ? reviews.overallMark : null
    const count = typeof reviews?.totalReviewCount === 'number' ? reviews.totalReviewCount : null
    return { rating, count }
  } catch {
    return { rating: null, count: null }
  }
}

export async function POST() {
  await connectDB()

  const tsId = await getSettingOrEnv('trusted_shops_id', 'TRUSTED_SHOPS_ID')
  if (!tsId) {
    return NextResponse.json({ error: 'Trusted Shops ID niet ingesteld (zie Instellingen)' }, { status: 400 })
  }

  // Haal alle producten op met een SKU
  const products = await Product.find({ sku: { $ne: '' } }, { _id: 1, sku: 1 }).lean()

  if (!products.length) {
    return NextResponse.json({ synced: 0, message: 'Geen producten met SKU gevonden.' })
  }

  let synced = 0
  let failed = 0

  for (const p of products) {
    const { rating, count } = await fetchTsRating(tsId, p.sku as string)

    if (rating !== null || count !== null) {
      const attrs: Record<string, string> = {}
      if (rating !== null) attrs['ts_rating'] = String(rating)
      if (count !== null) attrs['ts_review_count'] = String(count)

      await Product.updateOne(
        { _id: p._id },
        { $set: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [`attributes.${k}`, v])) }
      )
      synced++
    } else {
      failed++
    }

    // Kleine pauze om rate limiting te vermijden
    await new Promise(r => setTimeout(r, 50))
  }

  return NextResponse.json({
    synced,
    failed,
    total: products.length,
    message: `${synced} van ${products.length} producten bijgewerkt met TS-reviews.`,
  })
}
