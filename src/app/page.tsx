'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ImportLog {
  feedName: string; status: string; imported: number; updated: number; startedAt: string
}

interface ProductRow {
  _id: string; title: string; brand: string; shownCount: number; clickCount: number; imageLink: string
}

interface DayPoint { date: string; count: number }

interface DashboardData {
  sessions30d: number
  sessions7d: number
  resultsShown30d: number
  maatwerk30d: number
  maatwerkShown30d: number
  flowCount: number
  productCount: number
  attributeCount: number
  topShown: ProductRow[]
  topClicked: ProductRow[]
  dailySessions: DayPoint[]
  dailyResults: DayPoint[]
  dailyClicks: DayPoint[]
  dailyMaatwerk: DayPoint[]
}

interface ImportStats {
  totalProducts: number
  totalFeeds: number
  recentLogs: ImportLog[]
}

type SeriesKey = 'sessions' | 'results' | 'clicks' | 'maatwerk'

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'sessions',  label: 'Sessies',            color: '#60a5fa' },
  { key: 'results',   label: 'Resultaten getoond',  color: '#34d399' },
  { key: 'clicks',    label: 'Productklikken',      color: '#f59e0b' },
  { key: 'maatwerk',  label: 'Maatwerkverzoeken',   color: '#a78bfa' },
]

const PERIODS = [
  { key: 7,  label: '7 dagen' },
  { key: 30, label: '30 dagen' },
  { key: 90, label: '90 dagen' },
]

function MultiChart({ data, activeSeries, days }: {
  data: DashboardData
  activeSeries: Set<SeriesKey>
  days: number
}) {
  const seriesData: Record<SeriesKey, DayPoint[]> = {
    sessions:  data.dailySessions,
    results:   data.dailyResults,
    clicks:    data.dailyClicks,
    maatwerk:  data.dailyMaatwerk,
  }

  const allValues = SERIES
    .filter(s => activeSeries.has(s.key))
    .flatMap(s => seriesData[s.key].map(d => d.count))
  const max = Math.max(...allValues, 1)

  const dates = data.dailySessions.map(d => d.date)
  if (!dates.length) return <p className="text-sm text-gray-400 italic text-center py-6">Nog geen data.</p>

  const step = Math.max(1, Math.floor(dates.length / 6))
  const fmt = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate()} ${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][dt.getMonth()]}`
  }

  return (
    <div>
      <div className="flex items-end gap-px" style={{ height: 96 }}>
        {dates.map((date, i) => (
          <div key={date} className="flex-1 flex flex-col justify-end gap-px group relative h-full">
            {SERIES.filter(s => activeSeries.has(s.key)).map(s => {
              const val = (seriesData[s.key][i]?.count ?? 0)
              const h = max > 0 ? Math.max((val / max) * 88, val > 0 ? 2 : 0) : 0
              return <div key={s.key} style={{ height: h, backgroundColor: s.color, borderRadius: '2px 2px 0 0' }} />
            })}
            <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1.5 rounded whitespace-nowrap z-10 space-y-0.5">
              <p className="font-semibold border-b border-white/20 pb-0.5 mb-0.5">{fmt(date)}</p>
              {SERIES.filter(s => activeSeries.has(s.key)).map(s => (
                <p key={s.key} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  {s.label}: {seriesData[s.key][i]?.count ?? 0}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex mt-1">
        {dates.map((d, i) => (
          <div key={d} className="flex-1 text-center">
            <span className="text-xs text-gray-400" style={{ visibility: i % step === 0 || i === dates.length - 1 ? 'visible' : 'hidden' }}>
              {fmt(d)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [days, setDays] = useState(30)
  const [activeSeries, setActiveSeries] = useState<Set<SeriesKey>>(new Set(['sessions', 'results']))
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [imp, setImp] = useState<ImportStats | null>(null)

  useEffect(() => {
    setDash(null)
    fetch(`/api/dashboard?days=${days}`).then(r => r.json()).then(setDash)
  }, [days])

  useEffect(() => {
    Promise.all([
      fetch('/api/products?limit=1').then(r => r.json()),
      fetch('/api/config').then(r => r.json()),
      fetch('/api/logs?limit=5').then(r => r.json()),
    ]).then(([products, configs, logs]) => setImp({
      totalProducts: products.total ?? 0,
      totalFeeds: Array.isArray(configs) ? configs.length : 0,
      recentLogs: logs,
    }))
  }, [])

  const fmt = (d: string) => new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = { success: 'bg-green-100 text-green-700', error: 'bg-red-100 text-red-700', running: 'bg-yellow-100 text-yellow-700' }
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  const toggleSeries = (key: SeriesKey) => {
    setActiveSeries(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) } else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
        <p className="text-gray-500">Overzicht van gebruik en assortiment</p>
      </div>

      {/* KPI-balk */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Sessies (30 dagen)" value={dash?.sessions30d ?? '—'} sub={`${dash?.sessions7d ?? '—'} deze week`} href="/beheer/flows" color="blue" />
        <StatCard label="Resultaten getoond" value={dash?.resultsShown30d ?? '—'} sub="afgelopen 30 dagen" href="/beheer/flows" color="green" />
        <StatCard label="Maatwerk getoond" value={dash?.maatwerkShown30d ?? '—'} sub={`${dash?.maatwerk30d ?? '—'} verstuurd`} href="/beheer/flows" color="purple" />
        <StatCard label="Producten" value={imp?.totalProducts ?? '—'} href="/producten" color="orange" />
        <StatCard label="Attributen" value={dash?.attributeCount ?? '—'} sub="unieke veldnamen" href="/attributen" color="blue" />
      </div>

      {/* Tijdgrafiek */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-sm font-semibold text-gray-800">Verloop door de tijd</h2>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Periode */}
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setDays(p.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    days === p.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Serie-toggles */}
            <div className="flex gap-1.5 flex-wrap">
              {SERIES.map(s => (
                <button key={s.key} onClick={() => toggleSeries(s.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    activeSeries.has(s.key) ? 'border-transparent text-white' : 'border-gray-200 text-gray-400 bg-white'
                  }`}
                  style={activeSeries.has(s.key) ? { backgroundColor: s.color, borderColor: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!dash && <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />}
        {dash && <MultiChart data={dash} activeSeries={activeSeries} days={days} />}
      </div>

      {/* Meest vertoonde / geklikte producten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProductRankCard title="Meest vertoond" products={dash?.topShown ?? []} countKey="shownCount" countLabel="vertoond" />
        <ProductRankCard title="Meest geklikt" products={dash?.topClicked ?? []} countKey="clickCount" countLabel="klikken" />
      </div>

      {/* Recente imports */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Recente imports</h2>
        {!imp && <p className="text-gray-400 text-sm">Laden…</p>}
        {imp && imp.recentLogs.length === 0 && <p className="text-gray-400 text-sm">Nog geen imports.</p>}
        {imp && imp.recentLogs.length > 0 && (
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
              {imp.recentLogs.map((log, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-medium text-gray-800">{log.feedName}</td>
                  <td className="py-2">{statusBadge(log.status)}</td>
                  <td className="py-2 text-gray-600">{log.imported}</td>
                  <td className="py-2 text-gray-600">{log.updated}</td>
                  <td className="py-2 text-gray-400">{fmt(log.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4">
          <Link href="/logs" className="text-sm text-blue-600 hover:underline">Alle logs →</Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, href, color }: {
  label: string; value: string | number; sub?: string; href: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colors = {
    blue:   'text-blue-600',
    green:  'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  }
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[color]}`}>{typeof value === 'number' ? value.toLocaleString('nl-NL') : value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Link>
  )
}

function ProductRankCard({ title, products, countKey, countLabel }: {
  title: string
  products: ProductRow[]
  countKey: 'shownCount' | 'clickCount'
  countLabel: string
}) {
  const maxCount = products.length ? Math.max(...products.map(p => p[countKey]), 1) : 1
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-4">{title}</h2>
      {products.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nog geen data — gebruik de widget om data te verzamelen.</p>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => (
            <div key={p._id} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
              {p.imageLink
                ? <img src={p.imageLink} alt="" className="w-8 h-8 object-contain rounded border border-gray-100 shrink-0" />
                : <div className="w-8 h-8 bg-gray-100 rounded shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate">{p.title}</p>
                <div className="mt-0.5 h-1 bg-gray-100 rounded-full">
                  <div className="h-1 bg-blue-400 rounded-full" style={{ width: `${Math.round((p[countKey] / maxCount) * 100)}%` }} />
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-600 shrink-0">{p[countKey].toLocaleString('nl-NL')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
