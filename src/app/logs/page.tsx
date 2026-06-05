'use client'

import { useEffect, useState } from 'react'

interface ImportLog {
  _id: string
  feedName: string
  status: 'running' | 'success' | 'error'
  totalInFeed: number
  imported: number
  updated: number
  skipped: number
  importErrors: string[]
  startedAt: string
  completedAt: string | null
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/logs?limit=50')
      .then((r) => r.json())
      .then((d) => { setLogs(d); setLoading(false) })
  }, [])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
      running: 'bg-yellow-100 text-yellow-700',
    }
    const labels: Record<string, string> = {
      success: 'Geslaagd',
      error: 'Mislukt',
      running: 'Bezig',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {labels[status] ?? status}
      </span>
    )
  }

  const duration = (log: ImportLog) => {
    if (!log.completedAt) return '—'
    const ms = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Import logs</h1>
      <p className="text-gray-500 mb-8">Overzicht van alle uitgevoerde feed-imports.</p>

      {loading && <p className="text-gray-400 text-sm">Laden…</p>}
      {!loading && logs.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Nog geen imports uitgevoerd. Ga naar <strong>Feed configuratie</strong> om te starten.
        </div>
      )}

      {logs.map((log) => (
        <div key={log._id} className="bg-white rounded-xl border border-gray-200 mb-3">
          <button
            className="w-full text-left px-5 py-4 flex items-center gap-4"
            onClick={() => setExpanded(expanded === log._id ? null : log._id)}
          >
            <span className="flex-1">
              <span className="font-medium text-gray-900 text-sm">{log.feedName}</span>
              <span className="ml-3 text-xs text-gray-400">
                {new Date(log.startedAt).toLocaleDateString('nl-NL', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </span>
            <div className="flex items-center gap-3">
              {statusBadge(log.status)}
              <span className="text-xs text-gray-400">{duration(log)}</span>
              <span className="text-gray-400 text-xs">{expanded === log._id ? '▲' : '▼'}</span>
            </div>
          </button>

          {expanded === log._id && (
            <div className="border-t border-gray-100 px-5 py-4">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <Stat label="In feed" value={log.totalInFeed} />
                <Stat label="Nieuw" value={log.imported} color="green" />
                <Stat label="Bijgewerkt" value={log.updated} color="blue" />
                <Stat label="Overgeslagen" value={log.skipped} />
              </div>
              {log.importErrors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-600 mb-2">Fouten ({log.importErrors.length})</p>
                  <ul className="space-y-1">
                    {log.importErrors.slice(0, 10).map((err, i) => (
                      <li key={i} className="text-xs text-red-500 font-mono">{err}</li>
                    ))}
                    {log.importErrors.length > 10 && (
                      <li className="text-xs text-red-400">…en {log.importErrors.length - 10} meer</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: 'green' | 'blue' }) {
  const textColor = color === 'green' ? 'text-green-600' : color === 'blue' ? 'text-blue-600' : 'text-gray-800'
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{value.toLocaleString('nl-NL')}</p>
    </div>
  )
}
