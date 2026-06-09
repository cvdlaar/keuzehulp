'use client'

import { useEffect, useState } from 'react'

interface AttrRow {
  key: string
  count: number
  sample: string[]
}

export default function AttributenPage() {
  const [rows, setRows] = useState<AttrRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string[]>>({})
  const [loadingValues, setLoadingValues] = useState<string | null>(null)
  const [valueSearch, setValueSearch] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/products/fields?detail=1')
      .then(r => r.json())
      .then(d => { setRows(d.detail ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggle = async (key: string) => {
    if (expanded === key) { setExpanded(null); return }
    setExpanded(key)
    if (values[key]) return
    setLoadingValues(key)
    try {
      const r = await fetch(`/api/products/values?field=${encodeURIComponent(key)}`)
      const d = await r.json()
      setValues(v => ({ ...v, [key]: d.values ?? [] }))
    } finally {
      setLoadingValues(null)
    }
  }

  const filtered = rows.filter(r => !search || r.key.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Attributen</h1>
      <p className="text-gray-500 mb-6">
        Alle velden uit de feed die als attribuut zijn opgeslagen. Gebruik de veldnaam in matchregels en displayattributen van een keuzehulp.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoeken op veldnaam…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">{filtered.length} velden</span>
        </div>

        {loading && <p className="text-sm text-gray-400 p-5">Laden…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400 p-5 italic">Geen attributen gevonden.</p>
        )}

        {!loading && filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-gray-500">
                <th className="px-5 py-2.5 font-medium w-8"></th>
                <th className="px-5 py-2.5 font-medium">Veldnaam</th>
                <th className="px-5 py-2.5 font-medium text-right w-28">Producten</th>
                <th className="px-5 py-2.5 font-medium">Voorbeeldwaarden</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <>
                  <tr
                    key={r.key}
                    onClick={() => toggle(r.key)}
                    className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-2.5 text-gray-400 text-xs">
                      {expanded === r.key ? '▾' : '▸'}
                    </td>
                    <td className="px-5 py-2.5">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-blue-700 font-mono">{r.key}</code>
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-600 tabular-nums">
                      {r.count.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.sample.filter(Boolean).slice(0, 3).map((v, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded max-w-48 truncate">
                            {v}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expanded === r.key && (
                    <tr key={`${r.key}-values`} className="bg-gray-50 border-t border-gray-100">
                      <td colSpan={4} className="px-10 py-3">
                        {loadingValues === r.key ? (
                          <p className="text-xs text-gray-400">Laden…</p>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={valueSearch[r.key] ?? ''}
                              onChange={e => setValueSearch(s => ({ ...s, [r.key]: e.target.value }))}
                              onClick={e => e.stopPropagation()}
                              placeholder="Zoeken in waarden…"
                              className="mb-2 w-64 border border-gray-200 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                              {(values[r.key] ?? [])
                                .filter(v => !valueSearch[r.key] || v.toLowerCase().includes(valueSearch[r.key].toLowerCase()))
                                .map((v, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 bg-white border border-gray-200 text-gray-700 rounded">
                                    {v}
                                  </span>
                                ))}
                              {(values[r.key] ?? []).filter(v => !valueSearch[r.key] || v.toLowerCase().includes(valueSearch[r.key].toLowerCase())).length === 0 && (
                                <p className="text-xs text-gray-400 italic">Geen waarden gevonden.</p>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
