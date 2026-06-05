'use client'
import { useEffect, useState } from 'react'

interface User {
  _id: string
  name: string
  email: string
  role: 'user' | 'keyuser'
  active: boolean
  createdAt: string
}

export default function GebruikersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false) })
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

  const toggleActive = async (user: User) => {
    await fetch(`/api/users/${user._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    })
    load()
  }

  const changeRole = async (user: User, role: 'user' | 'keyuser') => {
    await fetch(`/api/users/${user._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    load()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gebruikersbeheer</h1>

      {/* Gebruiker toevoegen */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Nieuwe gebruiker</h2>
        <form onSubmit={createUser} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Naam</label>
              <input
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required placeholder="Jan de Vries"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">E-mailadres</label>
              <input
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required type="email" placeholder="jan@bedrijf.nl"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Wachtwoord</label>
              <input
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required type="password" placeholder="Min. 8 tekens"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rol</label>
              <select
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              >
                <option value="user">Gebruiker</option>
                <option value="keyuser">Key user</option>
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
      </div>

      {/* Gebruikerslijst */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Gebruikers</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 p-5">Laden…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400 p-5 italic">Geen gebruikers gevonden.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map(u => (
              <div key={u._id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${u.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                    {u.name}
                  </p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <select
                  value={u.role}
                  onChange={e => changeRole(u, e.target.value as 'user' | 'keyuser')}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="user">Gebruiker</option>
                  <option value="keyuser">Key user</option>
                </select>
                <button
                  onClick={() => toggleActive(u)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    u.active
                      ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {u.active ? 'Deactiveren' : 'Activeren'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
