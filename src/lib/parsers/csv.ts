import Papa from 'papaparse'
import type { ParsedProduct } from './xml'

function parsePrice(val: string | undefined): number {
  if (!val) return 0
  return parseFloat(val.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
}

// Channable CSV kolomnamen mappen naar interne velden
const FIELD_MAP: Record<string, keyof ParsedProduct | null> = {
  id: 'externalId',
  title: 'title',
  name: 'title',
  description: 'description',
  short_description: 'shortDescription',
  link: 'link',
  url: 'link',
  image_link: 'imageLink',
  image: 'imageLink',
  price: 'price',
  sale_price: 'salePrice',
  lowest_price: 'lowestPrice',
  availability: 'availability',
  brand: 'brand',
  gtin: 'ean',
  ean: 'ean',
  mpn: 'sku',
  sku: 'sku',
  product_type: 'category',
  category: 'category',
}

export function parseCSVFeed(csv: string): ParsedProduct[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/ /g, '_'),
  })

  return result.data.map((row) => {
    const product: ParsedProduct = {
      externalId: '',
      title: '',
      description: '',
      shortDescription: '',
      link: '',
      imageLink: '',
      price: 0,
      salePrice: null,
      lowestPrice: null,
      availability: '',
      brand: '',
      ean: '',
      sku: '',
      category: '',
      qtyIncrement: 1,
      attributes: {},
    }

    for (const [col, val] of Object.entries(row)) {
      const mapped = FIELD_MAP[col]
      if (mapped === 'price') {
        product.price = parsePrice(val)
      } else if (mapped === 'salePrice') {
        product.salePrice = val ? parsePrice(val) : null
      } else if (mapped === 'lowestPrice') {
        product.lowestPrice = val ? parsePrice(val) : null
      } else if (mapped && mapped !== null) {
        ;(product as unknown as Record<string, unknown>)[mapped] = val || ''
      } else {
        product.attributes[col] = val
      }
    }

    return product
  })
}

export type { ParsedProduct }
