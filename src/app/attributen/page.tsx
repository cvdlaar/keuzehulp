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

  useEffect(() => {
    fetch('/api/products/fields?detail=1')
      .then(r => r.json())
      .then(d => { setRows(d.detail ?? []); setLoading(false) })
  }, [])

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
                <th className="px-5 py-2.5 font-medium">Veldnaam</th>
                <th className="px-5 py-2.5 font-medium text-right w-28">Producten</th>
                <th className="px-5 py-2.5 font-medium">Voorbeeldwaarden</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => (
                <tr key={r.key} className="hover:bg-gray-50">
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
