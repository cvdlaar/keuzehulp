import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import User from '@/models/User'
import { getSession } from '@/lib/auth'

// Werkt alleen als er nog geen admin-gebruiker bestaat.
// Promoot de ingelogde gebruiker naar admin.
export async function POST() {
  await connectDB()

  const adminExists = await User.findOne({ role: 'admin' })
  if (adminExists) {
    return NextResponse.json({ error: 'Er is al een admin-gebruiker.' }, { status: 403 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })

  const user = await User.findByIdAndUpdate(
    session.userId,
    { role: 'admin' },
    { new: true }
  ).select('name email role')

  if (!user) return NextResponse.json({ error: 'Gebruiker niet gevonden.' }, { status: 404 })

  return NextResponse.json({ ok: true, name: user.name, email: user.email, role: user.role })
}
