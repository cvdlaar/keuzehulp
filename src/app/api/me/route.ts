import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import User from '@/models/User'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  if (session.userId === 'dev') {
    return NextResponse.json({ name: 'Dev Admin', email: 'admin', role: session.role })
  }

  await connectDB()
  const user = await User.findById(session.userId).select('name email role').lean()
  if (!user) return NextResponse.json(null, { status: 401 })

  return NextResponse.json({ name: user.name, email: user.email, role: user.role })
}
