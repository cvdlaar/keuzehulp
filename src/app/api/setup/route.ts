import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import User from '@/models/User'

// Eenmalige bootstrap: maakt de eerste keyuser aan als er nog geen gebruikers zijn.
// Daarna geeft dit endpoint altijd 403 terug.
export async function POST(req: NextRequest) {
  await connectDB()

  const count = await User.countDocuments()
  if (count > 0) {
    return NextResponse.json({ error: 'Setup al uitgevoerd.' }, { status: 403 })
  }

  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Naam, e-mail en wachtwoord zijn verplicht.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'keyuser',
  })

  return NextResponse.json(
    { _id: user._id, name: user.name, email: user.email, role: user.role },
    { status: 201 }
  )
}
