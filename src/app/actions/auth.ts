'use server'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import User from '@/models/User'
import { createSession, deleteSession } from '@/lib/auth'

export type LoginState = { error?: string } | undefined

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string ?? '')

  if (!email || !password) return { error: 'Vul alle velden in.' }

  // Dev-bypass: werkt alleen lokaal (nooit in productie)
  if (process.env.NODE_ENV === 'development' && email === 'admin' && password === 'admin') {
    await createSession('dev', 'keyuser')
    redirect('/beheer/flows')
  }

  await connectDB()
  const user = await User.findOne({ email, active: true }).lean()

  if (!user) return { error: 'E-mailadres of wachtwoord onjuist.' }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'E-mailadres of wachtwoord onjuist.' }

  await createSession(String(user._id), user.role)
  redirect('/beheer/flows')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
