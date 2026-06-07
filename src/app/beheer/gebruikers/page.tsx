'use client'

import { useEffect, useState } from 'react'

interface User {
  _id: string
  name: string
  email: string
  role: 'user' | 'keyuser' | 'admin'
  active: boolean
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  user: 'Gebruiker',
  keyuser: 'Key user',
  admin: 'Admin',
}

export default function GebruikersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [resetTarget, setResetTarget] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)

  const load = () => {
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then((data: User[]) => { setUsers(data); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Er ging iets mis.')
      return
    }
    setForm({ name: '', email: '', password: '', role: 'user' })
    load()
  }

  const updateUser = async (id: string, patch: Partial<User>) => {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    load()
  }

  const resetPassword = async (id: string) => {
    if (!newPassword || newPassword.length < 8) return
    setResetSaving(true)
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    setResetSaving(false)
    setResetTarget(null)
    setNewPassword('')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Gebruikersbeheer</h1>
        <p className="text-gray-500 text-sm">Beheer wie toegang heeft tot het admin-paneel.</p>
      </div>

      {/* Nieuwe gebruiker */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Nieuwe gebruiker aanmaken</h2>
        <form onSubmit={createUser} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Naam</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required placeholder="Jan de Vries"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">E-mailadres</label>
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required type="email" placeholder="jan@bedrijf.nl"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Wachtwoord</label>
              <input
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required type="password" placeholder="Min. 8 tekens"
                autoComplete="new-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              >
                <option value="user">Gebruiker</option>
                <option value="keyuser">Key user</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit" disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Aanmaken…' : 'Gebruiker aanmaken'}
          </button>
        </form>
      </section>

      {/* Gebruikerslijst */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Gebruikers ({users.length})</h2>
        </div>

        {loading && <p className="text-sm text-gray-400 p-5">Laden…</p>}
        {!loading && users.length === 0 && (
          <p className="text-sm text-gray-400 p-5 italic">Geen gebruikers gevonden.</p>
        )}

        {!loading && users.length > 0 && (
          <div className="divide-y divide-gray-50">
            {users.map(u => (
              <div key={u._id}>
                <div className="flex items-center gap-3 px-5 py-3">
                  {/* Avatar initialen */}
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${u.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                      {u.name}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>

                  {/* Rol */}
                  <select
                    value={u.role}
                    onChange={e => updateUser(u._id, { role: e.target.value as User['role'] })}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="user">Gebruiker</option>
                    <option value="keyuser">Key user</option>
                    <option value="admin">Admin</option>
                  </select>

                  {/* Wachtwoord reset */}
                  <button
                    onClick={() => { setResetTarget(resetTarget === u._id ? null : u._id); setNewPassword('') }}
                    className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-1"
                    title="Wachtwoord wijzigen"
                  >
                    Wachtwoord
                  </button>

                  {/* Activeer / deactiveer */}
                  <button
                    onClick={() => updateUser(u._id, { active: !u.active })}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      u.active
                        ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {u.active ? 'Deactiveren' : 'Activeren'}
                  </button>
                </div>

                {/* Wachtwoord-resetformulier */}
                {resetTarget === u._id && (
                  <div className="px-5 pb-3 flex items-center gap-2 bg-gray-50 border-t border-gray-100">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Nieuw wachtwoord (min. 8 tekens)"
                      autoComplete="new-password"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button
                      onClick={() => resetPassword(u._id)}
                      disabled={resetSaving || newPassword.length < 8}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      {resetSaving ? 'Opslaan…' : 'Opslaan'}
                    </button>
                    <button
                      onClick={() => { setResetTarget(null); setNewPassword('') }}
                      className="px-3 py-1.5 text-gray-400 hover:text-gray-600 text-sm"
                    >
                      Annuleren
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
