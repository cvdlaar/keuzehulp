import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IImportLog extends Document {
  feedConfigId: Types.ObjectId
  feedName: string
  status: 'running' | 'success' | 'error'
  totalInFeed: number
  imported: number
  updated: number
  skipped: number
  importErrors: string[]
  startedAt: Date
  completedAt: Date | null
}

const ImportLogSchema = new Schema<IImportLog>({
  feedConfigId: { type: Schema.Types.ObjectId, ref: 'FeedConfig', required: true },
  feedName: { type: String, required: true },
  status: { type: String, enum: ['running', 'success', 'error'], default: 'running' },
  totalInFeed: { type: Number, default: 0 },
  imported: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  importErrors: [{ type: String }],
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
})

export default mongoose.models.ImportLog || mongoose.model<IImportLog>('ImportLog', ImportLogSchema)
