import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Flow from '@/models/Flow'

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}

export async function GET() {
  await connectDB()
  const flows = await Flow.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json(flows)
}

export async function POST(req: NextRequest) {
  await connectDB()
  const body = await req.json()
  const { name, description } = body

  if (!name) {
    return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  }

  // Maak een lege startvraag aan
  const startId = uid()
  const flow = await Flow.create({
    name,
    description: description ?? '',
    startQuestionId: startId,
    questions: [
      {
        id: startId,
        text: 'Nieuwe vraag',
        type: 'single',
        answers: [],
      },
    ],
  })

  return NextResponse.json(flow, { status: 201 })
}
