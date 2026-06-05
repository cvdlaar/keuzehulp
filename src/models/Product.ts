import mongoose, { Schema, Document } from 'mongoose'

export interface IProduct extends Document {
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
  attributes: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProduct>(
  {
    externalId: { type: String, required: true, unique: true, index: true },
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
    attributes: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

ProductSchema.index({ title: 'text', brand: 'text', category: 'text' })

export default mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema)
