import { XMLParser } from 'fast-xml-parser'

export interface ParsedProduct {
  externalId: string
  title: string
  description: string
  shortDescription: string
  link: string
  imageLink: string
  price: number
  salePrice: number | null
  lowestPrice: number | null
  availability: string
  brand: string
  ean: string
  sku: string
  category: string
  qtyIncrement: number
  attributes: Record<string, string>
}

function parsePrice(val: string | number | undefined): number {
  if (!val) return 0
  return parseFloat(String(val).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
}

type AnyRecord = Record<string, unknown>

function extractProducts(data: AnyRecord): AnyRecord[] {
  // Google Shopping RSS: rss.channel.item[]
  const rss = data['rss'] as AnyRecord | undefined
  if (rss) {
    const channel = rss['channel'] as AnyRecord | undefined
    if (channel?.['item']) {
      const items = channel['item']
      return Array.isArray(items) ? (items as AnyRecord[]) : [items as AnyRecord]
    }
  }
  // Atom-achtige feeds: feed.entry[]
  const feed = data['feed'] as AnyRecord | undefined
  if (feed?.['entry']) {
    const entries = feed['entry']
    return Array.isArray(entries) ? (entries as AnyRecord[]) : [entries as AnyRecord]
  }
  return []
}

function getString(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = item[key]
    if (val !== undefined && val !== null) return String(val)
  }
  return ''
}

export function parseXMLFeed(xml: string): ParsedProduct[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    removeNSPrefix: true,
  })

  const data = parser.parse(xml) as AnyRecord
  const items = extractProducts(data)

  return items.map((item) => {
    const raw = item as Record<string, unknown>

    // Alle onbekende velden opslaan als attributes
    const knownKeys = new Set(['id', 'title', 'description', 'link', 'image_link', 'price',
      'sale_price', 'availability', 'brand', 'gtin', 'mpn', 'product_type',
      'identifier_exists', 'condition', 'google_product_category'])

    const attributes: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (!knownKeys.has(k) && v !== null && v !== undefined) {
        attributes[k] = String(v)
      }
    }

    return {
      externalId: getString(raw, 'id', 'mpn'),
      title: getString(raw, 'title'),
      description: getString(raw, 'description'),
      shortDescription: getString(raw, 'short_description'),
      link: getString(raw, 'link'),
      imageLink: getString(raw, 'image_link'),
      price: parsePrice(raw['price'] as string),
      salePrice: raw['sale_price'] ? parsePrice(raw['sale_price'] as string) : null,
      lowestPrice: raw['lowest_price'] ? parsePrice(raw['lowest_price'] as string) : null,
      availability: getString(raw, 'availability'),
      brand: getString(raw, 'brand'),
      ean: getString(raw, 'gtin'),
      sku: getString(raw, 'mpn', 'id'),
      category: getString(raw, 'product_type', 'google_product_category'),
      attributes,
    }
  })
}
