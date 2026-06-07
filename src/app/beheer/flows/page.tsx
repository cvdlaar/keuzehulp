'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Flow {
  _id: string
  name: string
  description: string
  active: boolean
  questions: unknown[]
  createdAt: string
}

export default function FlowsPage() {
  const router = useRouter()
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = () =>
    fetch('/api/flows')
      .then((r) => r.json())
      .then((d) => { setFlows(d); setLoading(false) })

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    const flow = await res.json()
    setCreating(false)
    router.push(`/beheer/flows/${flow._id}`)
  }

  const handleDuplicate = async (id: string) => {
    const res = await fetch(`/api/flows/${id}/duplicate`, { method: 'POST' })
    const copy = await res.json()
    load()
    router.push(`/beheer/flows/${copy._id}`)
  }

  const handleDelete = async (id: string, flowName: string) => {
    if (!confirm(`"${flowName}" verwijderen?`)) return
    await fetch(`/api/flows/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Keuzehulpen</h1>
          <p className="text-gray-500">Maak en beheer interactieve keuzehulp-flows.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Nieuwe flow
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Nieuwe keuzehulp</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bijv. Werkhandschoenen keuzehulp"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving (optioneel)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Voor welke pagina of doelgroep?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Aanmaken…' : 'Aanmaken en bewerken'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Overzicht</h2>
        {loading && <p className="text-gray-400 text-sm">Laden…</p>}
        {!loading && flows.length === 0 && (
          <p className="text-gray-400 text-sm">Nog geen flows aangemaakt.</p>
        )}
        {flows.map((f) => (
          <div key={f._id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3 mb-2 last:mb-0">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 text-sm">{f.name}</p>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${f.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {f.active ? 'Actief' : 'Inactief'}
                </span>
                <span className="text-xs text-gray-400">{f.questions.length} vragen</span>
              </div>
              {f.description && <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/beheer/flows/${f._id}`}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                Bewerken
              </Link>
              <button
                onClick={() => handleDuplicate(f._id)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Dupliceren
              </button>
              <button
                onClick={() => handleDelete(f._id, f.name)}
                className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors"
              >
                Verwijderen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
