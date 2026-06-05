import mongoose, { Schema, Document } from 'mongoose'
export type { FieldMapping } from '@/lib/mappingConstants'
export { DEFAULT_MAPPING, FIELD_LABELS } from '@/lib/mappingConstants'
import type { FieldMapping } from '@/lib/mappingConstants'
import { DEFAULT_MAPPING } from '@/lib/mappingConstants'

export type ImportSchedule = 'none' | 'hourly' | 'daily' | 'weekly'

export interface IFeedConfig extends Document {
  name: string
  url: string
  format: 'xml' | 'csv'
  active: boolean
  fieldMapping: FieldMapping
  lastImportAt: Date | null
  schedule: ImportSchedule
  nextImportAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const FeedConfigSchema = new Schema<IFeedConfig>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    format: { type: String, enum: ['xml', 'csv'], default: 'xml' },
    active: { type: Boolean, default: true },
    fieldMapping: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_MAPPING }) },
    lastImportAt: { type: Date, default: null },
    schedule: { type: String, enum: ['none', 'hourly', 'daily', 'weekly'], default: 'none' },
    nextImportAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.FeedConfig || mongoose.model<IFeedConfig>('FeedConfig', FeedConfigSchema)
