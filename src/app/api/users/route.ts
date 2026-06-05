import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import User from '@/models/User'

export async function GET() {
  await connectDB()
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean()
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  await connectDB()
  const { name, email, password, role } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Naam, e-mail en wachtwoord zijn verplicht.' }, { status: 400 })
  }

  const exists = await User.findOne({ email: email.toLowerCase() })
  if (exists) {
    return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: role === 'keyuser' ? 'keyuser' : 'user',
  })

  return NextResponse.json(
    { _id: user._id, name: user.name, email: user.email, role: user.role, active: user.active },
    { status: 201 }
  )
}
