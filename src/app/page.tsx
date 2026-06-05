'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  totalProducts: number
  totalFeeds: number
  lastImport: { feedName: string; status: string; startedAt: string } | null
  recentLogs: { feedName: string; status: string; imported: number; updated: number; startedAt: string }[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/products?limit=1').then((r) => r.json()),
      fetch('/api/config').then((r) => r.json()),
      fetch('/api/logs?limit=5').then((r) => r.json()),
    ]).then(([products, configs, logs]) => {
      setStats({
        totalProducts: products.total ?? 0,
        totalFeeds: Array.isArray(configs) ? configs.length : 0,
        lastImport: logs[0] ?? null,
        recentLogs: logs,
      })
    })
  }, [])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
      running: 'bg-yellow-100 text-yellow-700',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-gray-500 mb-8">Overzicht van het assortiment en imports</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Producten" value={stats?.totalProducts ?? '—'} href="/producten" />
        <StatCard label="Feed-configuraties" value={stats?.totalFeeds ?? '—'} href="/feed" />
        <StatCard
          label="Laatste import"
          value={
            stats?.lastImport
              ? new Date(stats.lastImport.startedAt).toLocaleDateString('nl-NL', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'
          }
          href="/logs"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Recente imports</h2>
        {!stats && <p className="text-gray-400 text-sm">Laden…</p>}
        {stats && stats.recentLogs.length === 0 && (
          <p className="text-gray-400 text-sm">Nog geen imports uitgevoerd.</p>
        )}
        {stats && stats.recentLogs.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Feed</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Nieuw</th>
                <th className="pb-2 font-medium">Bijgewerkt</th>
                <th className="pb-2 font-medium">Datum</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLogs.map((log, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-medium text-gray-800">{log.feedName}</td>
                  <td className="py-2">{statusBadge(log.status)}</td>
                  <td className="py-2 text-gray-600">{log.imported}</td>
                  <td className="py-2 text-gray-600">{log.updated}</td>
                  <td className="py-2 text-gray-400">
                    {new Date(log.startedAt).toLocaleDateString('nl-NL', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4">
          <Link href="/logs" className="text-sm text-blue-600 hover:underline">
            Alle logs bekijken →
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </Link>
  )
}
