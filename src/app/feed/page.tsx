'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_MAPPING, FIELD_LABELS } from '@/lib/mappingConstants'
import type { FieldMapping } from '@/lib/mappingConstants'

type ImportSchedule = 'none' | 'hourly' | 'daily' | 'weekly'

interface FeedConfig {
  _id: string
  name: string
  url: string
  format: 'xml' | 'csv'
  active: boolean
  fieldMapping: FieldMapping
  lastImportAt: string | null
  schedule: ImportSchedule
  nextImportAt: string | null
}

interface PreviewData {
  format: string
  rawStructureKeys?: string[]
  headers?: string[]
  sampleItems?: Record<string, unknown>[]
  sample?: Record<string, unknown>[]
}

const emptyForm = { name: '', url: '', format: 'xml' as 'xml' | 'csv' }

interface ImportProgress {
  logId: string
  feedId: string
  status: 'running' | 'success' | 'error'
  imported: number
  updated: number
  skipped: number
  totalInFeed: number
}

export default function FeedPage() {
  const [configs, setConfigs] = useState<FeedConfig[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, PreviewData>>({})
  const [mappingId, setMappingId] = useState<string | null>(null)
  const [mappingForm, setMappingForm] = useState<FieldMapping>({ ...DEFAULT_MAPPING })
  const [savingMapping, setSavingMapping] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () =>
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: FeedConfig[]) => { setConfigs(data); setLoading(false) })

  useEffect(() => { load() }, [])

  const notify = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editId ? 'PUT' : 'POST'
    const body = editId ? { id: editId, ...form } : form
    const res = await fetch('/api/config', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setForm(emptyForm)
      setEditId(null)
      load()
      notify('ok', editId ? 'Feed bijgewerkt.' : 'Feed toegevoegd.')
    } else {
      const err = await res.json()
      notify('err', err.error ?? 'Opslaan mislukt.')
    }
  }

  const handleImport = async (id: string) => {
    setImporting(id)
    setImportProgress(null)

    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedConfigId: id }),
    })

    if (!res.ok) {
      setImporting(null)
      const err = await res.json()
      notify('err', `Import mislukt: ${err.error}`)
      return
    }

    const { logId } = await res.json()

    // Poll de voortgang elke seconde
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/logs/${logId}`)
        if (!r.ok) return
        const log = await r.json() as ImportProgress & { status: string }
        setImportProgress({ ...log, logId, feedId: id } as ImportProgress)

        if (log.status !== 'running') {
          clearInterval(poll)
          setImporting(null)
          load()
          if (log.status === 'success') {
            notify('ok', `Import klaar — ${log.imported} nieuw, ${log.updated} bijgewerkt.`)
          } else {
            notify('err', 'Import mislukt. Zie logs voor details.')
          }
        }
      } catch {
        // ignore tijdelijke netwerkfouten
      }
    }, 1000)
  }

  const handlePreview = async (id: string) => {
    setPreviewing(id)
    const res = await fetch(`/api/preview?id=${id}`)
    const data: PreviewData = await res.json()
    setPreviewData((prev) => ({ ...prev, [id]: data }))
    setPreviewing(null)
  }

  const openMapping = (c: FeedConfig) => {
    setMappingId(c._id)
    setMappingForm({ ...DEFAULT_MAPPING, ...(c.fieldMapping ?? {}) })
  }

  const saveMapping = async () => {
    if (!mappingId) return
    setSavingMapping(true)
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: mappingId, fieldMapping: mappingForm }),
    })
    setSavingMapping(false)
    setMappingId(null)
    load()
    notify('ok', 'Veldmapping opgeslagen.')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Feed verwijderen?')) return
    await fetch(`/api/config?id=${id}`, { method: 'DELETE' })
    load()
    notify('ok', 'Feed verwijderd.')
  }

  const toggleActive = async (c: FeedConfig) => {
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c._id, active: !c.active }),
    })
    load()
  }

  const setSchedule = async (c: FeedConfig, schedule: ImportSchedule) => {
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c._id, schedule }),
    })
    load()
  }

  const feedKeys = (id: string): string[] => {
    const p = previewData[id]
    if (!p) return []
    return p.rawStructureKeys ?? p.headers ?? []
  }

  const mappingConfig = mappingId ? configs.find((c) => c._id === mappingId) : null
  const availableKeys = mappingId ? feedKeys(mappingId) : []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Feed configuratie</h1>
      <p className="text-gray-500 mb-8">Koppel je Channable-feed en stel de veldmapping in.</p>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Formulier nieuwe feed */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          {editId ? 'Feed bewerken' : 'Nieuwe feed toevoegen'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bijv. Logistiekconcurrent hoofdfeed"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feed URL (Channable)</label>
            <input
              type="url"
              required
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://feeds.channable.com/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Formaat</label>
            <select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value as 'xml' | 'csv' })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="xml">XML (Google Shopping / RSS)</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              {editId ? 'Opslaan' : 'Feed toevoegen'}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm(emptyForm) }}
                className="px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors">
                Annuleren
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lijst feeds */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Geconfigureerde feeds</h2>
        {loading && <p className="text-gray-400 text-sm">Laden…</p>}
        {!loading && configs.length === 0 && <p className="text-gray-400 text-sm">Nog geen feeds geconfigureerd.</p>}

        {configs.map((c) => (
          <div key={c._id} className="border border-gray-100 rounded-lg p-4 mb-3 last:mb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.active ? 'Actief' : 'Inactief'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600 font-medium uppercase">{c.format}</span>
                </div>
                <p className="text-xs text-gray-400 truncate">{c.url}</p>
                {c.lastImportAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Laatste import: {new Date(c.lastImportAt).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-gray-400">Automatisch:</span>
                  <select
                    value={c.schedule ?? 'none'}
                    onChange={e => setSchedule(c, e.target.value as ImportSchedule)}
                    className="border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-600 focus:outline-none"
                  >
                    <option value="none">Uit</option>
                    <option value="hourly">Elk uur</option>
                    <option value="daily">Dagelijks</option>
                    <option value="weekly">Wekelijks</option>
                  </select>
                  {c.nextImportAt && c.schedule !== 'none' && (
                    <span className="text-xs text-blue-500">
                      Volgende: {new Date(c.nextImportAt).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <button onClick={() => handleImport(c._id)} disabled={importing === c._id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {importing === c._id ? 'Importeren…' : '▶ Importeren'}
                </button>
                <button onClick={() => handlePreview(c._id)} disabled={previewing === c._id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  {previewing === c._id ? 'Laden…' : '👁 Preview'}
                </button>
                <button onClick={() => openMapping(c)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors">
                  ⇄ Mapping
                </button>
                <button onClick={() => { setEditId(c._id); setForm({ name: c.name, url: c.url, format: c.format }) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors">
                  Bewerken
                </button>
                <button onClick={() => toggleActive(c)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50 transition-colors">
                  {c.active ? 'Deactiveren' : 'Activeren'}
                </button>
                <button onClick={() => handleDelete(c._id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                  Verwijderen
                </button>
              </div>
            </div>

            {/* Importvoortgang */}
            {importing === c._id && importProgress?.feedId === c._id && (
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between text-xs text-blue-700 mb-1.5">
                  <span className="font-medium">Importeren…</span>
                  <span>
                    {importProgress.totalInFeed > 0
                      ? `${importProgress.imported + importProgress.updated + importProgress.skipped} / ${importProgress.totalInFeed}`
                      : `${importProgress.imported + importProgress.updated + importProgress.skipped} verwerkt`}
                  </span>
                </div>
                {importProgress.totalInFeed > 0 && (
                  <div className="w-full bg-blue-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round(((importProgress.imported + importProgress.updated + importProgress.skipped) / importProgress.totalInFeed) * 100))}%` }}
                    />
                  </div>
                )}
                <div className="flex gap-3 mt-1.5 text-xs text-blue-600">
                  <span>{importProgress.imported} nieuw</span>
                  <span>{importProgress.updated} bijgewerkt</span>
                  {importProgress.skipped > 0 && <span>{importProgress.skipped} overgeslagen</span>}
                </div>
              </div>
            )}

            {/* Preview resultaat */}
            {previewData[c._id] && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  Gevonden veldnamen in de feed ({feedKeys(c._id).length}):
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {feedKeys(c._id).map((k) => (
                    <span key={k} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-700">{k}</span>
                  ))}
                </div>
                {previewData[c._id].sampleItems?.[0] || previewData[c._id].sample?.[0] ? (
                  <>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Eerste product (ruw):</p>
                    <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-auto max-h-48 text-gray-700">
                      {JSON.stringify(previewData[c._id].sampleItems?.[0] ?? previewData[c._id].sample?.[0], null, 2)}
                    </pre>
                  </>
                ) : null}
                <button onClick={() => openMapping(c)}
                  className="mt-3 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors">
                  ⇄ Mapping instellen op basis van deze velden
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mapping modal */}
      {mappingId && mappingConfig && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Veldmapping — {mappingConfig.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Koppel feedkolommen aan interne velden</p>
              </div>
              <button onClick={() => setMappingId(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {availableKeys.length === 0 && (
              <div className="px-6 py-4 bg-yellow-50 text-yellow-700 text-sm">
                Klik eerst op <strong>👁 Preview</strong> om de veldnamen uit de feed te laden. Zo kun je ze selecteren in de dropdowns.
              </div>
            )}

            <div className="px-6 py-4 space-y-3">
              {(Object.keys(DEFAULT_MAPPING) as (keyof FieldMapping)[]).map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-36 text-sm text-gray-700 shrink-0">{FIELD_LABELS[field]}</label>
                  {availableKeys.length > 0 ? (
                    <select
                      value={mappingForm[field]}
                      onChange={(e) => setMappingForm({ ...mappingForm, [field]: e.target.value })}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">— niet mappen —</option>
                      {availableKeys.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={mappingForm[field]}
                      onChange={(e) => setMappingForm({ ...mappingForm, [field]: e.target.value })}
                      placeholder="veldnaam in feed"
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button onClick={saveMapping} disabled={savingMapping}
                className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {savingMapping ? 'Opslaan…' : 'Mapping opslaan'}
              </button>
              <button onClick={() => setMappingId(null)}
                className="px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors">
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
