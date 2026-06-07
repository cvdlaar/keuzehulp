'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DemoFlow { _id: string; name: string; demoEnabled: boolean }
interface GlobalConfig { shopName: string }

export default function DemoIndexPage() {
  const [flows, setFlows] = useState<DemoFlow[]>([])
  const [config, setConfig] = useState<GlobalConfig>({ shopName: 'DemoShop' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/flows').then(r => r.ok ? r.json() : []),
      fetch('/api/demo').then(r => r.ok ? r.json() : {}),
    ]).then(([allFlows, globalData]) => {
      setFlows((allFlows as DemoFlow[]).filter((f: DemoFlow) => f.demoEnabled))
      setConfig({ shopName: (globalData as { shopName?: string }).shopName ?? 'DemoShop' })
      setLoading(false)
    })
  }, [])

  if (loading) return null

  if (flows.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-gray-500 text-sm">Geen demo&apos;s beschikbaar.</p>
        </div>
      </div>
    )
  }

  if (flows.length === 1) {
    // Direct doorsturen naar de enige demo
    if (typeof window !== 'undefined') window.location.replace(`/demo/${flows[0]._id}`)
    return null
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-lg text-gray-900">{config.shopName}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Demo-omgevingen</h1>
        <p className="text-gray-500 text-sm mb-8">Kies een keuzehulp om de integratie te bekijken.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {flows.map(f => (
            <Link
              key={f._id}
              href={`/demo/${f._id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{f.name}</p>
              <p className="text-xs text-gray-400 mt-1">Demo bekijken →</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
