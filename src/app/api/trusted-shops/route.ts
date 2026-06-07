import { NextRequest, NextResponse } from 'next/server'
import { getSettingOrEnv } from '@/lib/settings'

const BASE = 'https://cdn1.api.trustedshops.com'

// Eenvoudige in-memory cache (overleeft server-restart niet, maar voorkomt hammering)
const cache = new Map<string, { data: unknown; expires: number }>()

async function tsGet(path: string) {
  const cached = cache.get(path)
  if (cached && cached.expires > Date.now()) return cached.data

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (process.env.TRUSTED_SHOPS_USER && process.env.TRUSTED_SHOPS_PASS) {
    headers.Authorization = `Basic ${Buffer.from(`${process.env.TRUSTED_SHOPS_USER}:${process.env.TRUSTED_SHOPS_PASS}`).toString('base64')}`
  }

  const res = await fetch(`${BASE}${path}`, { headers, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TS ${res.status}: ${path}`)
  const data = await res.json()
  cache.set(path, { data, expires: Date.now() + 3600_000 })
  return data
}

// GET /api/trusted-shops?type=shop
// GET /api/trusted-shops?type=product&sku=ABC123
export async function GET(req: NextRequest) {
  const TSID = await getSettingOrEnv('trusted_shops_id', 'TRUSTED_SHOPS_ID')
  if (!TSID) return NextResponse.json({ error: 'TRUSTED_SHOPS_ID niet ingesteld' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    if (type === 'shop') {
      const data = await tsGet(`/shops/${TSID}/v2/shop.json`) as Record<string, unknown>
      const responseData = ((data as Record<string, unknown>).response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined
      const shop = responseData?.shop as Record<string, unknown> | undefined
      const rating = shop?.qualityIndicators as Record<string, unknown> | undefined
      return NextResponse.json({
        rating: rating?.reviewIndicator as Record<string, unknown> | undefined,
        name: shop?.name,
      })
    }

    if (type === 'product') {
      const sku = searchParams.get('sku')
      if (!sku) return NextResponse.json({ error: 'sku vereist' }, { status: 400 })
      const data = await tsGet(`/shops/${TSID}/v2/reviews/products/${encodeURIComponent(sku)}.json`) as Record<string, unknown>
      const reviews = (data as Record<string, Record<string, unknown>>).response?.data as Record<string, unknown> | undefined
      return NextResponse.json({
        rating: reviews?.overallMark,
        count: reviews?.totalReviewCount,
      })
    }

    return NextResponse.json({ error: 'type=shop of type=product vereist' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fout' }, { status: 502 })
  }
}
