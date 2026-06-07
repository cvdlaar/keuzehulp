import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IMaatwerkSubmission extends Document {
  _id: Types.ObjectId
  flowId: string
  flowName: string
  answerId: string
  answerText: string
  selections: { questionText: string; answerText: string }[]
  fields: { label: string; type: string; value: string }[]
  files: { label: string; filename: string; url: string }[]
  contact: {
    naam: string
    email: string
    telefoon: string
    straat: string
    postcode: string
    plaats: string
  }
  createdAt: Date
}

const MaatwerkSubmissionSchema = new Schema<IMaatwerkSubmission>(
  {
    flowId: { type: String, required: true },
    flowName: { type: String, default: '' },
    answerId: { type: String, required: true },
    answerText: { type: String, default: '' },
    selections: [{ questionText: String, answerText: String, _id: false }],
    fields: [{ label: String, type: String, value: String, _id: false }],
    files: [{ label: String, filename: String, url: String, _id: false }],
    contact: {
      naam: { type: String, default: '' },
      email: { type: String, default: '' },
      telefoon: { type: String, default: '' },
      straat: { type: String, default: '' },
      postcode: { type: String, default: '' },
      plaats: { type: String, default: '' },
    },
  },
  { timestamps: true }
)

export default mongoose.models.MaatwerkSubmission as mongoose.Model<IMaatwerkSubmission>
  || mongoose.model<IMaatwerkSubmission>('MaatwerkSubmission', MaatwerkSubmissionSchema)
