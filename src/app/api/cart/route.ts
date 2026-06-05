import { NextRequest, NextResponse } from 'next/server'

// Proxy naar Adobe Commerce (Magento 2) REST API.
// Vereist in .env.local:
//   ADOBE_COMMERCE_TOKEN=<integration/admin bearer token>
//
// De storeUrl komt van de flow (adobeCommerceUrl).

async function magentoPost(storeUrl: string, path: string, body?: unknown) {
  const token = process.env.ADOBE_COMMERCE_TOKEN
  const res = await fetch(`${storeUrl.replace(/\/$/, '')}/rest/V1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Magento ${res.status}: ${text}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  const { sku, qty = 1, storeUrl } = await req.json()

  if (!sku || !storeUrl) {
    return NextResponse.json({ error: 'sku en storeUrl zijn verplicht' }, { status: 400 })
  }

  try {
    // 1. Maak een guest cart aan
    const cartId: string = await magentoPost(storeUrl, '/guest-carts')

    // 2. Voeg product toe aan de cart
    await magentoPost(storeUrl, `/guest-carts/${cartId}/items`, {
      cartItem: { sku, qty, quote_id: cartId },
    })

    // 3. Geef de checkout URL terug
    // De widget slaat cartId op in localStorage als 'guest-cartid'
    // zodat Magento het bij checkout oppakt.
    return NextResponse.json({
      cartId,
      checkoutUrl: `${storeUrl.replace(/\/$/, '')}/checkout/`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
