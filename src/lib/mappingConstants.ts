export interface FieldMapping {
  externalId: string
  title: string
  description: string
  shortDescription: string
  link: string
  imageLink: string
  price: string
  salePrice: string
  lowestPrice: string
  availability: string
  brand: string
  ean: string
  sku: string
  category: string
}

export const DEFAULT_MAPPING: FieldMapping = {
  externalId: 'id',
  title: 'title',
  description: 'description',
  shortDescription: 'short_description',
  link: 'link',
  imageLink: 'image_link',
  price: 'price',
  salePrice: 'sale_price',
  lowestPrice: 'lowest_price',
  availability: 'availability',
  brand: 'brand',
  ean: 'gtin',
  sku: 'mpn',
  category: 'product_type',
}

export const FIELD_LABELS: Record<keyof FieldMapping, string> = {
  externalId: 'Product ID *',
  title: 'Titel *',
  description: 'Omschrijving',
  shortDescription: 'Korte omschrijving',
  link: 'Product URL',
  imageLink: 'Afbeelding URL',
  price: 'Prijs',
  salePrice: 'Actieprijs',
  lowestPrice: 'Staffelprijs (laagste)',
  availability: 'Beschikbaarheid',
  brand: 'Merk',
  ean: 'EAN / GTIN',
  sku: 'SKU / MPN',
  category: 'Categorie',
}
