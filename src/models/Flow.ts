import mongoose, { Schema, Document, Types } from 'mongoose'

export interface MaatwerkField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'file'
  required: boolean
  placeholder: string
}

export type MatchOperator =
  | 'contains' | 'notContains'
  | 'equals' | 'notEquals'
  | 'startsWith'
  | 'gt' | 'gte' | 'lt' | 'lte'

export interface MatchRule {
  field: string
  operator: MatchOperator
  value: string
}

export interface Answer {
  id: string
  text: string
  label: string
  info: string
  imageUrl: string
  nextQuestionId: string | null
  matchRules: MatchRule[]
  pinnedProductIds: string[]
  relatedRules: MatchRule[]
  relatedPinnedIds: string[]
  maatwerkMode: boolean
}

export type AnswerLayout = 'text' | 'image' | 'image-text' | 'size'

export type BorderRadius = 'none' | 'small' | 'medium' | 'large'

export interface WidgetBehavior {
  enableAnimations: boolean      // slide-animatie tussen vragen
  rememberAnswers: boolean       // antwoorden opslaan in localStorage
  progressStyle: 'bar' | 'steps' // voortgangsbalk of "Vraag X van Y"
  showProductReviews: boolean    // Trusted Shops productreviews
  showShopRating: boolean        // Trusted Shops shopbeoordeling in footer
}

export const DEFAULT_BEHAVIOR: WidgetBehavior = {
  enableAnimations: true,
  rememberAnswers: false,
  progressStyle: 'bar',
  showProductReviews: false,
  showShopRating: false,
}

export interface WidgetStyle {
  primaryColor: string    // hex, bijv. "#2563eb"
  borderRadius: BorderRadius
  fontFamily: string      // CSS font-family string, leeg = overerven
}

export const DEFAULT_WIDGET_STYLE: WidgetStyle = {
  primaryColor: '#2563eb',
  borderRadius: 'medium',
  fontFamily: '',
}

export interface Question {
  id: string
  text: string
  intro: string
  type: 'single' | 'multi' | 'range'
  layout: AnswerLayout
  imageColumns: 2 | 3 | 4
  answers: Answer[]
  // Range-type specific
  rangeField: string
  rangeUnit: string
  rangeMin: number
  rangeMax: number
  rangeStep: number
  rangeStrictFilter: boolean
  rangeNextQuestionId: string | null
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
  adobeCommerceUrl: string
  widgetStyle: WidgetStyle
  widgetBehavior: WidgetBehavior
  emailResults: boolean
  emailSubject: string
  spotlerAttributes: Record<string, string>
  resultsSummaryTemplate: string
  resultsTitle: string
  displayAttributes: string[]
  maatwerkTitle: string
  maatwerkIntro: string
  maatwerkEmailTo: string
  maatwerkFields: MaatwerkField[]
  maatwerkIncludeAddress: boolean
  createdAt: Date
  updatedAt: Date
}

const MatchRuleSchema = new Schema<MatchRule>(
  {
    field: { type: String, required: true },
    operator: { type: String, enum: ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'gt', 'gte', 'lt', 'lte'], required: true },
    value: { type: String, required: true },
  },
  { _id: false }
)

const MaatwerkFieldSchema = new Schema<MaatwerkField>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'textarea', 'number', 'email', 'phone', 'file'], default: 'text' },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
  },
  { _id: false }
)

const AnswerSchema = new Schema<Answer>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    label: { type: String, default: '' },
    info: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    nextQuestionId: { type: String, default: null },
    matchRules: [MatchRuleSchema],
    pinnedProductIds: [{ type: String }],
    relatedRules: [MatchRuleSchema],
    relatedPinnedIds: [{ type: String }],
    maatwerkMode: { type: Boolean, default: false },
  },
  { _id: false }
)

const QuestionSchema = new Schema<Question>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    intro: { type: String, default: '' },
    type: { type: String, enum: ['single', 'multi', 'range'], default: 'single' },
    layout: { type: String, enum: ['text', 'image', 'image-text', 'size'], default: 'text' },
    imageColumns: { type: Number, default: 2 },
    answers: [AnswerSchema],
    rangeField: { type: String, default: '' },
    rangeUnit: { type: String, default: '' },
    rangeMin: { type: Number, default: 0 },
    rangeMax: { type: Number, default: 1000 },
    rangeStep: { type: Number, default: 1 },
    rangeStrictFilter: { type: Boolean, default: false },
    rangeNextQuestionId: { type: String, default: null },
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
    widgetStyle: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_WIDGET_STYLE }) },
    widgetBehavior: { type: Schema.Types.Mixed, default: () => ({ ...DEFAULT_BEHAVIOR }) },
    emailResults: { type: Boolean, default: false },
    emailSubject: { type: String, default: '' },
    spotlerAttributes: { type: Schema.Types.Mixed, default: {} },
    resultsSummaryTemplate: { type: String, default: '' },
    resultsTitle: { type: String, default: '' },
    displayAttributes: [{ type: String }],
    maatwerkTitle: { type: String, default: '' },
    maatwerkIntro: { type: String, default: '' },
    maatwerkEmailTo: { type: String, default: '' },
    maatwerkFields: [MaatwerkFieldSchema],
    maatwerkIncludeAddress: { type: Boolean, default: false },
  },
  { timestamps: true }
)

// In development, het model weggooien zodat HMR schema-wijzigingen (zoals nieuwe velden) direct worden opgepikt.
if (process.env.NODE_ENV === 'development') {
  try { mongoose.deleteModel('Flow') } catch { /* model bestond nog niet */ }
}

export default mongoose.models.Flow as mongoose.Model<IFlow> || mongoose.model<IFlow>('Flow', FlowSchema)
