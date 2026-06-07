'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

interface DemoFlow {
  _id: string
  name: string
  demoEnabled: boolean
  demoShopName?: string
}

const DUMMY_PRODUCTS = [
  { name: 'Model A – Standaard', price: '€ 299,-', badge: null },
  { name: 'Model B – Comfort',   price: '€ 449,-', badge: 'Bestseller' },
  { name: 'Model C – Pro',       price: '€ 599,-', badge: null },
  { name: 'Model D – Premium',   price: '€ 749,-', badge: 'Nieuw' },
  { name: 'Model E – Ultra',     price: '€ 999,-', badge: null },
  { name: 'Model F – Basic',     price: '€ 199,-', badge: 'Aanbieding' },
]

export default function DemoFlowPage() {
  const { id } = useParams<{ id: string }>()
  const [flow, setFlow] = useState<DemoFlow | null>(null)
  const [shopName, setShopName] = useState('DemoShop')
  const [widgetHeight, setWidgetHeight] = useState(520)
  const [notFound, setNotFound] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/demo/${id}`).then(r => r.ok ? r.json() : null),
      fetch('/api/demo').then(r => r.ok ? r.json() : { shopName: 'DemoShop' }),
    ]).then(([flowData, globalData]) => {
      if (!flowData) { setNotFound(true); return }
      setFlow(flowData)
      setShopName((globalData as { shopName?: string }).shopName ?? 'DemoShop')
    })
  }, [id])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.source === 'keuzehulp' && e.data?.type === 'resize' && e.data?.height) {
        setWidgetHeight(Math.max(400, Number(e.data.height) + 32))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (notFound || (flow && !flow.demoEnabled)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-gray-500 text-sm">Deze demo is niet beschikbaar.</p>
        </div>
      </div>
    )
  }

  if (!flow) return null

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Shop header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-6">
          <span className="font-bold text-lg text-gray-900 tracking-tight">{shopName}</span>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <span className="cursor-default hover:text-gray-900 transition-colors">Producten</span>
            <span className="cursor-default hover:text-gray-900 transition-colors">Merken</span>
            <span className="cursor-default hover:text-gray-900 transition-colors">Over ons</span>
            <span className="cursor-default hover:text-gray-900 transition-colors">Contact</span>
          </nav>
          <div className="flex items-center gap-3 text-gray-500">
            <button className="text-sm hover:text-gray-900 transition-colors">🔍</button>
            <button className="text-sm hover:text-gray-900 transition-colors">🛒 0</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <span className="cursor-default">Home</span>
          <span>›</span>
          <span className="cursor-default">Producten</span>
          <span>›</span>
          <span className="text-gray-600">{flow.name}</span>
        </nav>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Vind het juiste product</h1>
            <p className="text-gray-500 text-sm mb-5">
              Beantwoord een paar vragen en we tonen direct de beste keuze voor jouw situatie.
            </p>
            <div
              className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50"
              style={{ height: widgetHeight, transition: 'height 0.3s ease' }}
            >
              <iframe
                ref={iframeRef}
                src={`/widget/${id}`}
                className="w-full h-full border-0"
                title={flow.name}
              />
            </div>
          </div>

          <aside className="space-y-6">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm font-semibold text-blue-800 mb-1">Waarom een keuzehulp?</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                Met onze keuzehulp beantwoord je in een paar stappen welk product het best bij jou past.
                Geen overbodige zoekfilters — gewoon de juiste keuze.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Populaire keuzes</p>
              <div className="space-y-2">
                {DUMMY_PRODUCTS.slice(0, 3).map(p => (
                  <div key={p.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-gray-200" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">{p.name}</p>
                        {p.badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">{p.badge}</span>}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{p.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-14">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Alle producten <span className="text-gray-400 font-normal text-base">({DUMMY_PRODUCTS.length})</span>
            </h2>
            <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none bg-white">
              <option>Meest relevant</option>
              <option>Prijs laag–hoog</option>
              <option>Prijs hoog–laag</option>
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {DUMMY_PRODUCTS.map(p => (
              <div key={p.name} className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow cursor-default">
                <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-300 text-2xl">□</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800 leading-snug">{p.name}</p>
                  <p className="text-xs font-bold text-gray-900 mt-1">{p.price}</p>
                </div>
                {p.badge && <span className="self-start text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">{p.badge}</span>}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="mt-16 border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        <p>{shopName} — Dit is een demo-omgeving</p>
      </footer>
    </div>
  )
}
