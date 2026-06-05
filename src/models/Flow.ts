import mongoose, { Schema, Document, Types } from 'mongoose'

export interface MatchRule {
  field: string
  operator: 'contains' | 'equals' | 'startsWith' | 'notContains'
  value: string
}

export interface Answer {
  id: string
  text: string
  imageUrl: string
  nextQuestionId: string | null
  matchRules: MatchRule[]
  pinnedProductIds: string[]
}

export type AnswerLayout = 'text' | 'image' | 'image-text' | 'size'

export interface Question {
  id: string
  text: string
  type: 'single' | 'multi'
  layout: AnswerLayout
  answers: Answer[]
}

export interface SkuBoostEntry {
  sku: string
  points: number
}

export interface BoostConfig {
  availabilityBoost: number        // 0–200 punten extra voor "in stock"
  pricePreference: 'cheapest' | 'mostExpensive' | 'none'
  priceBoost: number               // 0–200 punten voor goedkoopste/duurste
  marginField: string              // veldnaam in product.attributes (leeg = uit)
  marginBoost: number              // 0–200 punten voor hoogste marge
  skuBoosts: SkuBoostEntry[]       // vaste punten voor specifieke SKU's
}

export const DEFAULT_BOOST: BoostConfig = {
  availabilityBoost: 30,
  pricePreference: 'cheapest',
  priceBoost: 10,
  marginField: '',
  marginBoost: 0,
  skuBoosts: [],
}

export interface IFlow extends Document {
  _id: Types.ObjectId
  name: string
  description: string
  startQuestionId: string
  questions: Question[]
  active: boolean
  boostConfig: BoostConfig
  adobeCommerceUrl: string   // bijv. https://mystore.com (leeg = knop verborgen)
  createdAt: Date
  updatedAt: Date
}

const MatchRuleSchema = new Schema<MatchRule>(
  {
    field: { type: String, required: true },
    operator: { type: String, enum: ['contains', 'equals', 'startsWith', 'notContains'], required: true },
    value: { type: String, required: true },
  },
  { _id: false }
)

const AnswerSchema = new Schema<Answer>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    nextQuestionId: { type: String, default: null },
    matchRules: [MatchRuleSchema],
    pinnedProductIds: [{ type: String }],
  },
  { _id: false }
)

const QuestionSchema = new Schema<Question>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['single', 'multi'], default: 'single' },
    layout: { type: String, enum: ['text', 'image', 'image-text', 'size'], default: 'text' },
    answers: [AnswerSchema],
  },
  { _id: false }
)

const FlowSchema = new Schema<IFlow>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    startQuestionId: { type: String, default: '' },
    questions: [QuestionSchema],
    active: { type: Boolean, default: true },
    boostConfig: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_BOOST }) },
    adobeCommerceUrl: { type: String, default: '' },
  },
  { timestamps: true }
)

export default mongoose.models.Flow || mongoose.model<IFlow>('Flow', FlowSchema)
