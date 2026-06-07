import mongoose, { Schema, Document } from 'mongoose'

export type EventType =
  | 'question_shown'
  | 'answer_selected'
  | 'results_shown'
  | 'no_results'
  | 'product_shown'
  | 'product_click'
  | 'add_to_cart'

export interface IEvent extends Document {
  flowId: string
  sessionId: string
  type: EventType
  data: Record<string, string | number>
  createdAt: Date
}

const EventSchema = new Schema<IEvent>(
  {
    flowId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true },
    type: {
      type: String,
      enum: ['question_shown', 'answer_selected', 'results_shown', 'no_results', 'product_shown', 'product_click', 'add_to_cart'],
      required: true,
    },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

EventSchema.index({ flowId: 1, type: 1 })
EventSchema.index({ flowId: 1, createdAt: -1 })

export default mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema)
