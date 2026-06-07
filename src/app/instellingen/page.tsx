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

export default function InstellingenPage() {
  const [me, setMe] = useState<{ role: string } | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [savingUser, setSavingUser] = useState(false)
  const [userError, setUserError] = useState('')

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(setMe)
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(setSettings)
    loadUsers()
  }, [])

  const loadUsers = () => {
    setUsersLoading(true)
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then((d: User[]) => { setUsers(d); setUsersLoading(false) })
  }

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }))

  const saveSettings = async () => {
    setSavingSettings(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 3000)
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingUser(true)
    setUserError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm),
    })
    setSavingUser(false)
    if (!res.ok) {
      const d = await res.json()
      setUserError(d.error ?? 'Er ging iets mis.')
      return
    }
    setUserForm({ name: '', email: '', password: '', role: 'user' })
    loadUsers()
  }

  const updateUser = async (id: string, patch: Partial<User>) => {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    loadUsers()
  }

  if (me && me.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Alleen admins hebben toegang tot deze pagina.
      </div>
    )
  }

  function TsImportButton() {
    const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [result, setResult] = useState('')

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setState('running')
      setResult('')
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/trusted-shops/import', { method: 'POST', body: form })
      const d = await res.json()
      if (res.ok) {
        setResult(d.message ?? `${d.updated} producten bijgewerkt.`)
        setState('done')
      } else {
        setResult(d.error ?? 'Er ging iets mis.')
        setState('error')
      }
      e.target.value = ''
    }

    return (
      <div className="flex items-center gap-3 flex-wrap">
        <label className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
          state === 'running' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}>
          {state === 'running' ? 'Verwerken…' : 'CSV importeren'}
          <input type="file" accept=".csv" className="hidden" disabled={state === 'running'} onChange={handleFile} />
        </label>
        {result && (
          <span className={`text-sm ${state === 'done' ? 'text-green-600' : 'text-red-500'}`}>{result}</span>
        )}
      </div>
    )
  }

  function TsyncButton() {
    const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [result, setResult] = useState('')

    const run = async () => {
      setState('running')
      setResult('')
      const res = await fetch('/api/trusted-shops/sync', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setResult(d.message ?? `${d.synced} producten bijgewerkt.`)
        setState('done')
      } else {
        setResult(d.error ?? 'Er ging iets mis.')
        setState('error')
      }
    }

    return (
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={run}
          disabled={state === 'running'}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          {state === 'running' ? 'Reviews ophalen…' : 'TS Reviews synchroniseren'}
        </button>
        {result && (
          <span className={`text-sm ${state === 'done' ? 'text-green-600' : 'text-red-500'}`}>{result}</span>
        )}
      </div>
    )
  }

  function BackfillButton() {
    const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [result, setResult] = useState('')

    const run = async () => {
      setState('running')
      const res = await fetch('/api/admin/backfill-counters', { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setResult(`${d.productsUpdated} producten bijgewerkt (${d.uniqueProducts} uniek in events).`)
        setState('done')
      } else {
        setResult('Er ging iets mis.')
        setState('error')
      }
    }

    return (
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={run}
          disabled={state === 'running'}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          {state === 'running' ? 'Bezig…' : 'Tellers herberekenen'}
        </button>
        {result && (
          <span className={`text-sm ${state === 'done' ? 'text-green-600' : 'text-red-500'}`}>{result}</span>
        )}
      </div>
    )
  }

  const Field = ({ label, desc, settingKey, type = 'text', placeholder = '' }: {
    label: string; desc?: string; settingKey: string; type?: string; placeholder?: string
  }) => (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-gray-700">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <input
        type={type}
        value={settings[settingKey] ?? ''}
        onChange={e => set(settingKey, e.target.value)}
        placeholder={placeholder}
        className="w-64 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 shrink-0"
        autoComplete="new-password"
      />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Instellingen</h1>

      {/* SMTP */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">E-mail (SMTP)</h2>
        <p className="text-xs text-gray-400 mb-4">Voor "Mail mij de resultaten" in de widget.</p>
        <Field label="SMTP host" placeholder="smtp.gmail.com" settingKey="smtp_host" />
        <Field label="SMTP poort" placeholder="587" settingKey="smtp_port" />
        <Field label="Gebruikersnaam" placeholder="jouw@email.nl" settingKey="smtp_user" />
        <Field label="Wachtwoord / App-wachtwoord" type="password" settingKey="smtp_pass" />
        <Field label="Afzender (From)" placeholder="noreply@bedrijf.nl" settingKey="smtp_from" desc="Leeg = zelfde als gebruikersnaam" />
      </section>

      {/* Trusted Shops */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Trusted Shops</h2>
        <p className="text-xs text-gray-400 mb-4">Vereist voor productreviews en shopbeoordeling in de widget.</p>
        <Field label="Trusted Shops ID" placeholder="X...ABC123" settingKey="trusted_shops_id" />
        <div className="pt-3 mt-3 border-t border-gray-50">
          <p className="text-xs text-gray-500 mb-2">
            Reviews synchroniseren haalt voor elk product met een EAN-code de Trusted Shops score op en slaat
            deze op als attribuut (<code className="bg-gray-100 px-1 rounded">ts_rating</code> en{' '}
            <code className="bg-gray-100 px-1 rounded">ts_review_count</code>). Gebruik daarna{' '}
            <strong>ts_rating</strong> als boost-veld in een keuzehulp.
          </p>
          <div className="flex flex-col gap-2">
            <TsyncButton />
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>of upload een CSV met kolommen</span>
              <code className="bg-gray-100 px-1 rounded">sku, rating, count</code>
            </div>
            <TsImportButton />
          </div>
        </div>
      </section>

      {/* Adobe Commerce */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Adobe Commerce (Magento)</h2>
        <p className="text-xs text-gray-400 mb-4">Voor de "In winkelwagen" knop in de widget.</p>
        <Field label="Integration bearer token" type="password" settingKey="adobe_commerce_token" />
      </section>

      <button
        onClick={saveSettings}
        disabled={savingSettings}
        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {savingSettings ? 'Opslaan…' : settingsSaved ? '✓ Opgeslagen' : 'Instellingen opslaan'}
      </button>

      {/* Data-onderhoud */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Data-onderhoud</h2>
        <p className="text-xs text-gray-400 mb-4">
          Herbereken de "Getoond"/"Geklikt" tellers op producten op basis van alle bestaande event-data.
          Gebruik dit eenmalig na een update of als tellers niet kloppen.
        </p>
        <BackfillButton />
      </section>

      {/* Gebruikersbeheer */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Gebruikers</h2>
        <form onSubmit={createUser} className="space-y-3 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Naam</label>
              <input
                value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
                required placeholder="Jan de Vries"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">E-mailadres</label>
              <input
                value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                required type="email" placeholder="jan@bedrijf.nl"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Wachtwoord</label>
              <input
                value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                required type="password" placeholder="Min. 8 tekens"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rol</label>
              <select
                value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              >
                <option value="user">Gebruiker</option>
                <option value="keyuser">Key user</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {userError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{userError}</p>}
          <button type="submit" disabled={savingUser}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {savingUser ? 'Aanmaken…' : 'Gebruiker aanmaken'}
          </button>
        </form>

        {usersLoading ? (
          <p className="text-sm text-gray-400">Laden…</p>
        ) : (
          <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden">
            {users.map(u => (
              <div key={u._id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${u.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{u.name}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <select
                  value={u.role}
                  onChange={e => updateUser(u._id, { role: e.target.value as User['role'] })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="user">Gebruiker</option>
                  <option value="keyuser">Key user</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={() => updateUser(u._id, { active: !u.active })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    u.active ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600' : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {u.active ? 'Deactiveren' : 'Activeren'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
