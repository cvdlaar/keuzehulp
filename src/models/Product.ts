import mongoose, { Schema, Document } from 'mongoose'

export interface IProduct extends Document {
  externalId: string
  storeView: string
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
  shownCount: number
  clickCount: number
  cartCount: number
  attributes: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProduct>(
  {
    externalId: { type: String, required: true, index: true },
    storeView: { type: String, default: 'NL-NL', index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    link: { type: String, default: '' },
    imageLink: { type: String, default: '' },
    price: { type: Number, default: 0 },
    salePrice: { type: Number, default: null },
    lowestPrice: { type: Number, default: null },
    availability: { type: String, default: 'unknown' },
    brand: { type: String, default: '' },
    ean: { type: String, default: '' },
    sku: { type: String, default: '' },
    category: { type: String, default: '' },
    qtyIncrement: { type: Number, default: 1 },
    shownCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    cartCount: { type: Number, default: 0 },
    attributes: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

ProductSchema.index({ externalId: 1, storeView: 1 }, { unique: true })
ProductSchema.index({ title: 'text', brand: 'text', category: 'text' })

export default mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema)
