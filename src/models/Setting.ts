import mongoose, { Schema, Document } from 'mongoose'

export interface ISetting extends Document {
  key: string
  value: string
  updatedAt: Date
}

const SettingSchema = new Schema<ISetting>(
  {
    key:   { type: String, required: true, unique: true },
    value: { type: String, default: '' },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
)

export default mongoose.models.Setting || mongoose.model<ISetting>('Setting', SettingSchema)
