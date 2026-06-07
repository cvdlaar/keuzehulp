import mongoose, { Schema, Document, Types } from 'mongoose'

export interface MappingDiagnosticEntry {
  internalField: string
  feedKey: string
  found: boolean
  sample: string
}

export interface IImportLog extends Document {
  feedConfigId: Types.ObjectId
  feedName: string
  status: 'running' | 'success' | 'error' | 'cancelled'
  cancelRequested: boolean
  totalInFeed: number
  imported: number
  updated: number
  skipped: number
  importErrors: string[]
  mappingDiagnostics: MappingDiagnosticEntry[]
  rawKeys: string[]
  attributeSample: Record<string, string>
  startedAt: Date
  completedAt: Date | null
}

const ImportLogSchema = new Schema<IImportLog>({
  feedConfigId: { type: Schema.Types.ObjectId, ref: 'FeedConfig', required: true },
  feedName: { type: String, required: true },
  status: { type: String, enum: ['running', 'success', 'error', 'cancelled'], default: 'running' },
  cancelRequested: { type: Boolean, default: false },
  totalInFeed: { type: Number, default: 0 },
  imported: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  importErrors: [{ type: String }],
  mappingDiagnostics: { type: Schema.Types.Mixed, default: [] },
  rawKeys: { type: [String], default: [] },
  attributeSample: { type: Schema.Types.Mixed, default: {} },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
})

export default mongoose.models.ImportLog || mongoose.model<IImportLog>('ImportLog', ImportLogSchema)
