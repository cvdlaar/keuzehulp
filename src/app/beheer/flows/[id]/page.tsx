'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

interface MatchRule {
  field: string
  operator: 'contains' | 'equals' | 'startsWith' | 'notContains'
  value: string
}

interface Answer {
  id: string
  text: string
  imageUrl: string
  nextQuestionId: string | null
  matchRules: MatchRule[]
  pinnedProductIds: string[]
}

type AnswerLayout = 'text' | 'image' | 'image-text' | 'size'

interface Question {
  id: string
  text: string
  type: 'single' | 'multi'
  layout: AnswerLayout
  answers: Answer[]
}

interface SkuBoostEntry {
  sku: string
  points: number
}

interface BoostConfig {
  availabilityBoost: number
  pricePreference: 'cheapest' | 'mostExpensive' | 'none'
  priceBoost: number
  marginField: string
  marginBoost: number
  skuBoosts: SkuBoostEntry[]
}

const DEFAULT_BOOST: BoostConfig = {
  availabilityBoost: 30,
  pricePreference: 'cheapest',
  priceBoost: 10,
  marginField: '',
  marginBoost: 0,
  skuBoosts: [],
}

interface Flow {
  _id: string
  name: string
  description: string
  startQuestionId: string
  questions: Question[]
  active: boolean
  boostConfig: BoostConfig
  adobeCommerceUrl?: string
}

interface ProductHit {
  _id: string
  title: string
  brand: string
  imageLink: string
  externalId: string
}

const OPERATORS = [
  { value: 'contains', label: 'bevat' },
  { value: 'notContains', label: 'bevat niet' },
  { value: 'equals', label: 'is gelijk aan' },
  { value: 'startsWith', label: 'begint met' },
]

const FIELDS = [
  { value: 'category', label: 'Categorie' },
  { value: 'brand', label: 'Merk' },
  { value: 'title', label: 'Titel' },
  { value: 'availability', label: 'Beschikbaarheid' },
]

// ── Stroomschema component (SVG-based) ──────────────────────────────────────

function FlowChart({ flow, onEdit }: { flow: Flow; onEdit: () => void }) {
  const NW = 200, NH = 64       // node width / height
  const CS = 260, RS = 160      // column spacing / row spacing
  const PAD = 50                // padding around diagram

  const qMap = new Map(flow.questions.map((q, i) => [q.id, { q, index: i }]))

  if (flow.questions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Geen vragen — ga naar de Editor om vragen toe te voegen.
      </div>
    )
  }

  // ── 1. BFS om rijen te bepalen ───────────────────────────
  const rowOf = new Map<string, number>()
  const bfsQueue: { id: string; row: number }[] = [{ id: flow.startQuestionId, row: 0 }]
  const seen = new Set<string>()

  while (bfsQueue.length) {
    const { id, row } = bfsQueue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    // Sla de diepste rij op (voor vragen bereikbaar via meerdere paden)
    rowOf.set(id, Math.max(row, rowOf.get(id) ?? 0))
    const entry = qMap.get(id)
    if (!entry) continue
    const nexts = [...new Set(
      entry.q.answers.map(a => a.nextQuestionId).filter((x): x is string => x !== null)
    )]
    nexts.forEach(nid => { if (!seen.has(nid)) bfsQueue.push({ id: nid, row: row + 1 }) })
  }

  // Niet-bereikbare vragen onderaan
  let maxKnownRow = Math.max(0, ...rowOf.values())
  flow.questions.forEach(q => {
    if (!rowOf.has(q.id)) rowOf.set(q.id, ++maxKnownRow)
  })

  // ── 2. Groepeer per rij, bereken posities ────────────────
  const byRow = new Map<number, string[]>()
  rowOf.forEach((row, id) => {
    if (!byRow.has(row)) byRow.set(row, [])
    byRow.get(row)!.push(id)
  })

  const maxCols = Math.max(...[...byRow.values()].map(v => v.length))
  const svgW = Math.max(maxCols * CS + PAD * 2, NW + PAD * 2)

  const posOf = new Map<string, { x: number; y: number }>()
  byRow.forEach((ids, row) => {
    const totalW = ids.length * CS
    const startX = (svgW - totalW) / 2 + (CS - NW) / 2
    ids.forEach((id, ci) => {
      posOf.set(id, { x: startX + ci * CS, y: row * RS + PAD })
    })
  })

  // ── 3. Resultaten-knoop ──────────────────────────────────
  const maxRow = Math.max(0, ...rowOf.values())
  const resultsY = (maxRow + 1) * RS + PAD
  const resultsX = svgW / 2 - NW / 2
  const hasResults = flow.questions.some(q => q.answers.some(a => a.nextQuestionId === null))
  const svgH = (hasResults ? resultsY + NH : maxRow * RS + NH) + PAD

  // ── 4. Pijlen ────────────────────────────────────────────
  interface Arrow { fromId: string; toId: string | null; label: string; hasRules: boolean }
  const arrows: Arrow[] = []
  flow.questions.forEach(q =>
    q.answers.forEach(a =>
      arrows.push({ fromId: q.id, toId: a.nextQuestionId, label: a.text,
        hasRules: a.matchRules.length + a.pinnedProductIds.length > 0 })
    )
  )

  const nodeBtm = (id: string) => { const p = posOf.get(id); return p ? { x: p.x + NW / 2, y: p.y + NH } : null }
  const nodeTop = (id: string) => { const p = posOf.get(id); return p ? { x: p.x + NW / 2, y: p.y } : null }

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-2">
      <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
        <defs>
          <marker id="ah-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#93c5fd" />
          </marker>
          <marker id="ah-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#4ade80" />
          </marker>
        </defs>

        {/* Pijlen */}
        {arrows.map((arrow, i) => {
          const from = nodeBtm(arrow.fromId)
          if (!from) return null
          let toX: number, toY: number, isResult = false

          if (arrow.toId) {
            const to = nodeTop(arrow.toId)
            if (!to) return null
            toX = to.x; toY = to.y
          } else {
            toX = resultsX + NW / 2; toY = resultsY; isResult = true
          }

          const cy1 = from.y + (toY - from.y) * 0.45
          const cy2 = from.y + (toY - from.y) * 0.55
          const d = `M ${from.x} ${from.y} C ${from.x} ${cy1}, ${toX} ${cy2}, ${toX} ${toY}`
          const lx = (from.x + toX) / 2
          const ly = (from.y + toY) / 2
          const raw = arrow.label || ''
          const lbl = raw.length > 18 ? raw.slice(0, 17) + '…' : raw
          const lblW = lbl.length * 5.8 + (arrow.hasRules ? 14 : 0) + 8

          return (
            <g key={i}>
              <path d={d} fill="none" stroke={isResult ? '#4ade80' : '#93c5fd'}
                strokeWidth="1.5" markerEnd={isResult ? 'url(#ah-green)' : 'url(#ah-blue)'} />
              {lbl && (
                <g>
                  <rect x={lx - lblW / 2} y={ly - 9} width={lblW} height={15} rx={3}
                    fill="white" fillOpacity="0.9" stroke={isResult ? '#bbf7d0' : '#bfdbfe'} strokeWidth="1" />
                  <text x={lx} y={ly + 2} textAnchor="middle" fontSize="10" fill="#4b5563" fontFamily="system-ui, sans-serif">
                    {lbl}{arrow.hasRules ? ' ⚙' : ''}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Vraag-knopen */}
        {flow.questions.map(q => {
          const pos = posOf.get(q.id)
          if (!pos) return null
          const entry = qMap.get(q.id)!
          const isStart = q.id === flow.startQuestionId
          const title = `V${entry.index + 1}`
          const sub = q.text.length > 24 ? q.text.slice(0, 23) + '…' : q.text

          return (
            <g key={q.id}>
              {/* Schaduw */}
              <rect x={pos.x + 2} y={pos.y + 3} width={NW} height={NH} rx={9} fill="#00000010" />
              {/* Box */}
              <rect x={pos.x} y={pos.y} width={NW} height={NH} rx={9}
                fill={isStart ? '#eff6ff' : '#ffffff'}
                stroke={isStart ? '#3b82f6' : '#bfdbfe'}
                strokeWidth={isStart ? 2 : 1.5} />
              {/* START badge */}
              {isStart && (
                <g>
                  <rect x={pos.x + 8} y={pos.y + 7} width={34} height={14} rx={4} fill="#3b82f6" />
                  <text x={pos.x + 25} y={pos.y + 18} textAnchor="middle" fontSize="8"
                    fill="white" fontWeight="bold" fontFamily="system-ui, sans-serif">START</text>
                </g>
              )}
              {/* Vraagnummer */}
              <text x={pos.x + NW / 2} y={pos.y + (isStart ? 34 : 26)}
                textAnchor="middle" fontSize="12" fontWeight="700"
                fill={isStart ? '#1d4ed8' : '#1e40af'} fontFamily="system-ui, sans-serif">
                {title}
              </text>
              {/* Vraagtekst */}
              <text x={pos.x + NW / 2} y={pos.y + (isStart ? 50 : 44)}
                textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="system-ui, sans-serif">
                {sub}
              </text>
            </g>
          )
        })}

        {/* Resultaten-knoop */}
        {hasResults && (
          <g>
            <rect x={resultsX + 2} y={resultsY + 3} width={NW} height={NH} rx={9} fill="#00000010" />
            <rect x={resultsX} y={resultsY} width={NW} height={NH} rx={9}
              fill="#f0fdf4" stroke="#22c55e" strokeWidth={2} />
            <text x={resultsX + NW / 2} y={resultsY + NH / 2 + 5}
              textAnchor="middle" fontSize="13" fontWeight="700"
              fill="#15803d" fontFamily="system-ui, sans-serif">
              ✓ Resultaten
            </text>
          </g>
        )}
      </svg>

      <div className="mt-4 text-center">
        <button onClick={onEdit} className="text-sm text-blue-600 hover:underline">
          ← Terug naar editor
        </button>
      </div>
    </div>
  )
}

// ── Statistieken tab ─────────────────────────────────────────────────────────

interface AnalyticsData {
  totalSessions: number
  completions: number
  noResults: number
  completionRate: number
  noResultsRate: number
  questions: { text: string; impressions: number; answers: { id: string; text: string; count: number }[] }[]
  productClicks: { productId: string; title: string; count: number }[]
  addToCarts: { productId: string; title: string; count: number }[]
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-2 bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-6 text-right">{value}</span>
    </div>
  )
}

function StatistiekenTab({ flowId }: { flowId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/flows/${flowId}/analytics`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [flowId])

  if (loading) return <p className="text-sm text-gray-400">Laden…</p>
  if (!data) return <p className="text-sm text-red-400">Kon statistieken niet laden.</p>

  return (
    <div className="space-y-5">
      {/* Overzicht */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sessies', value: data.totalSessions },
          { label: 'Afgerond', value: `${data.completions} (${data.completionRate}%)` },
          { label: 'Geen resultaten', value: `${data.noResults} (${data.noResultsRate}%)` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Per vraag */}
      {data.questions.map(q => {
        const maxCount = Math.max(...q.answers.map(a => a.count), 1)
        return (
          <div key={q.text} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800 truncate">{q.text}</p>
              <span className="text-xs text-gray-400 shrink-0 ml-2">{q.impressions}× getoond</span>
            </div>
            {q.answers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Geen antwoorden geregistreerd.</p>
            ) : (
              <div className="space-y-2">
                {q.answers.map(a => (
                  <div key={a.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 truncate">{a.text}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {q.impressions > 0 ? Math.round((a.count / q.impressions) * 100) : 0}%
                      </span>
                    </div>
                    <Bar value={a.count} max={maxCount} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Productklikken */}
      {data.productClicks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Productklikken</p>
          <div className="space-y-2">
            {data.productClicks.map(p => (
              <div key={p.productId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600 truncate">{p.title || p.productId}</span>
                </div>
                <Bar value={p.count} max={data.productClicks[0].count} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add to cart */}
      {data.addToCarts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">In winkelwagen</p>
          <div className="space-y-2">
            {data.addToCarts.map(p => (
              <div key={p.productId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600 truncate">{p.title || p.productId}</span>
                </div>
                <Bar value={p.count} max={data.addToCarts[0].count} />
              </div>
            ))}
          </div>
        </div>
      )}

      {data.totalSessions === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-8">
          Nog geen statistieken beschikbaar. Start de widget om data te verzamelen.
        </p>
      )}
    </div>
  )
}

// ── Embed tab ────────────────────────────────────────────────────────────────

function EmbedTab({ flowId, flowName }: { flowId: string; flowName: string }) {
  const [copied, setCopied] = useState(false)
  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const snippet = `<!-- Keuzehulp: ${flowName} -->
<div id="keuzehulp-${flowId}"></div>
<script>
(function(){
  var el = document.getElementById('keuzehulp-${flowId}');
  var iframe = document.createElement('iframe');
  iframe.src = '${serverUrl}/widget/${flowId}';
  iframe.style.cssText = 'width:100%;height:600px;border:none;display:block;overflow:hidden;';
  iframe.scrolling = 'no';
  el.appendChild(iframe);

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'keuzehulp') return;

    // Auto-resize
    if (e.data.type === 'resize' && e.data.height) {
      iframe.style.height = (e.data.height + 40) + 'px';
    }

    // Analytics naar dataLayer (Google Tag Manager)
    if (e.data.type === 'event') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'keuzehulp_' + e.data.eventType,
        keuzehulp_flow: '${flowId}',
        keuzehulp_data: e.data
      });
    }

    // In winkelwagen — pas aan voor jouw webshop
    if (e.data.type === 'add_to_cart') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'keuzehulp_add_to_cart',
        ecommerce: { add: { products: [{ id: e.data.sku, quantity: 1 }] } }
      });
      // Magento 2 voorbeeld (vereist dat Require.js beschikbaar is):
      // require(['Magento_Checkout/js/action/add-to-cart'], function(addToCart) {
      //   addToCart({ sku: e.data.sku, qty: 1 });
      // });
    }
  });
})();
<\/script>`

  const copy = () => {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        Plak dit als <strong>Custom HTML-tag</strong> in Google Tag Manager.
        Stel de trigger in op de pagina's waar je de keuzehulp wil tonen.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500 font-mono">GTM Custom HTML</span>
          <button
            onClick={copy}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
              copied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            {copied ? '✓ Gekopieerd' : 'Kopieer'}
          </button>
        </div>
        <pre className="text-xs text-gray-700 p-4 overflow-auto leading-relaxed">{snippet}</pre>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Stap voor stap</h3>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Kopieer de code hierboven</li>
          <li>Ga naar GTM → Tags → Nieuw → <strong>Custom HTML</strong></li>
          <li>Plak de code en sla op</li>
          <li>Stel een <strong>trigger</strong> in op de gewenste pagina's (bijv. URL bevat <code className="bg-gray-100 px-1 rounded">/categorie/fietsen</code>)</li>
          <li>Publiceer de container</li>
        </ol>
        <div className="mt-2 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            <strong>In winkelwagen:</strong> De code bevat een placeholder voor Magento 2.
            Pas het <code className="bg-gray-100 px-1 rounded">add_to_cart</code>-blok aan voor jouw webshop.
            Events worden ook via <code className="bg-gray-100 px-1 rounded">dataLayer.push</code> gestuurd voor extra GTM-tags.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Hoofdpagina ──────────────────────────────────────────────────────────────

type Tab = 'editor' | 'schema' | 'preview' | 'instellingen' | 'statistieken' | 'embed'

export default function FlowEditorPage() {
  const { id } = useParams<{ id: string }>()
  const [flow, setFlow] = useState<Flow | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('editor')
  const [previewKey, setPreviewKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedAnswer, setExpandedAnswer] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState<Record<string, string>>({})
  const [productResults, setProductResults] = useState<Record<string, ProductHit[]>>({})

  useEffect(() => {
    fetch(`/api/flows/${id}`)
      .then((r) => r.json())
      .then((d) => setFlow(d))
  }, [id])

  const save = async (flowData: Flow) => {
    setSaving(true)
    await fetch(`/api/flows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flowData),
    })
    setSaving(false)
    setSaved(true)
    setPreviewKey((k) => k + 1)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = useCallback((updater: (f: Flow) => Flow) => {
    setFlow((prev) => {
      if (!prev) return prev
      return updater(prev)
    })
  }, [])

  // ── Vragen ──────────────────────────────────────────────
  const addQuestion = () => {
    const newId = uid()
    update((f) => ({
      ...f,
      questions: [
        ...f.questions,
        { id: newId, text: 'Nieuwe vraag', type: 'single', layout: 'text', answers: [] },
      ],
    }))
  }

  const removeQuestion = (qId: string) => {
    update((f) => ({
      ...f,
      questions: f.questions.filter((q) => q.id !== qId),
      startQuestionId:
        f.startQuestionId === qId
          ? (f.questions[0]?.id ?? '')
          : f.startQuestionId,
    }))
  }

  const updateQuestion = (qId: string, patch: Partial<Question>) => {
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId ? { ...q, ...patch } : q
      ),
    }))
  }

  // ── Antwoorden ──────────────────────────────────────────
  const addAnswer = (qId: string) => {
    const newId = uid()
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: [
                ...q.answers,
                {
                  id: newId,
                  text: 'Nieuw antwoord',
                  imageUrl: '',
                  nextQuestionId: null,
                  matchRules: [],
                  pinnedProductIds: [],
                },
              ],
            }
          : q
      ),
    }))
  }

  const removeAnswer = (qId: string, aId: string) => {
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? { ...q, answers: q.answers.filter((a) => a.id !== aId) }
          : q
      ),
    }))
  }

  const updateAnswer = (qId: string, aId: string, patch: Partial<Answer>) => {
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId ? { ...a, ...patch } : a
              ),
            }
          : q
      ),
    }))
  }

  // ── Matchregels ─────────────────────────────────────────
  const addRule = (qId: string, aId: string) => {
    const newRule: MatchRule = { field: 'category', operator: 'contains', value: '' }
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId
                  ? { ...a, matchRules: [...a.matchRules, newRule] }
                  : a
              ),
            }
          : q
      ),
    }))
  }

  const updateRule = (
    qId: string,
    aId: string,
    rIdx: number,
    patch: Partial<MatchRule>
  ) => {
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId
                  ? {
                      ...a,
                      matchRules: a.matchRules.map((r, i) =>
                        i === rIdx ? { ...r, ...patch } : r
                      ),
                    }
                  : a
              ),
            }
          : q
      ),
    }))
  }

  const removeRule = (qId: string, aId: string, rIdx: number) => {
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId
                  ? {
                      ...a,
                      matchRules: a.matchRules.filter((_, i) => i !== rIdx),
                    }
                  : a
              ),
            }
          : q
      ),
    }))
  }

  // ── Producten zoeken & pinnen ────────────────────────────
  const searchProducts = async (answerKey: string, query: string) => {
    setProductSearch((p) => ({ ...p, [answerKey]: query }))
    if (!query.trim()) {
      setProductResults((p) => ({ ...p, [answerKey]: [] }))
      return
    }
    const res = await fetch(
      `/api/products?search=${encodeURIComponent(query)}&limit=8`
    )
    const data = await res.json()
    setProductResults((p) => ({ ...p, [answerKey]: data.products ?? [] }))
  }

  const togglePin = (
    qId: string,
    aId: string,
    productId: string,
    currentPins: string[]
  ) => {
    const next = currentPins.includes(productId)
      ? currentPins.filter((p) => p !== productId)
      : [...currentPins, productId]
    updateAnswer(qId, aId, { pinnedProductIds: next })
  }

  if (!flow) return <div className="text-gray-400 text-sm p-4">Laden…</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'editor', label: '✏ Editor' },
    { key: 'schema', label: '⬡ Stroomschema' },
    { key: 'preview', label: '▶ Voorbeeld' },
    { key: 'instellingen', label: '⚙ Instellingen' },
    { key: 'statistieken', label: '📊 Statistieken' },
    { key: 'embed', label: '</> Embed' },
  ]

  const boost: BoostConfig = { ...DEFAULT_BOOST, ...(flow?.boostConfig ?? {}) }
  const updateBoost = (patch: Partial<BoostConfig>) =>
    update(f => ({ ...f, boostConfig: { ...boost, ...patch } }))

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="flex-1">
          <Link
            href="/beheer/flows"
            className="text-xs text-gray-400 hover:text-gray-600 mb-2 inline-block"
          >
            ← Terug naar overzicht
          </Link>
          <input
            value={flow.name}
            onChange={(e) => update((f) => ({ ...f, name: e.target.value }))}
            className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full"
          />
          <input
            value={flow.description}
            onChange={(e) =>
              update((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Omschrijving…"
            className="text-sm text-gray-500 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none w-full mt-1"
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={flow.active}
              onChange={(e) =>
                update((f) => ({ ...f, active: e.target.checked }))
              }
              className="rounded"
            />
            Actief
          </label>
          <button
            onClick={() => save(flow)}
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Opslaan…' : saved ? '✓ Opgeslagen' : 'Opslaan'}
          </button>
        </div>
      </div>

      {/* Tabbladen */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Editor ── */}
      {activeTab === 'editor' && (
        <>
          {flow.questions.length > 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-3">
              <span className="text-sm text-blue-700 font-medium">Startvraag:</span>
              <select
                value={flow.startQuestionId}
                onChange={(e) =>
                  update((f) => ({ ...f, startQuestionId: e.target.value }))
                }
                className="border border-blue-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {flow.questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-4">
            {flow.questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Vraag header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {qIdx + 1}
                  </span>
                  <input
                    value={q.text}
                    onChange={(e) =>
                      updateQuestion(q.id, { text: e.target.value })
                    }
                    className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                  />
                  <select
                    value={q.type}
                    onChange={(e) =>
                      updateQuestion(q.id, {
                        type: e.target.value as 'single' | 'multi',
                      })
                    }
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none"
                  >
                    <option value="single">Enkelvoudig</option>
                    <option value="multi">Meervoudig</option>
                  </select>
                  <select
                    value={q.layout ?? 'text'}
                    onChange={(e) =>
                      updateQuestion(q.id, { layout: e.target.value as AnswerLayout })
                    }
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none"
                  >
                    <option value="text">Tekst</option>
                    <option value="image">Afbeeldingen</option>
                    <option value="image-text">Afb. + tekst</option>
                    <option value="size">Maten / chips</option>
                  </select>
                  {flow.startQuestionId === q.id && (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-600 font-medium">
                      Start
                    </span>
                  )}
                  <button
                    onClick={() => removeQuestion(q.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                    title="Vraag verwijderen"
                  >
                    ×
                  </button>
                </div>

                {/* Antwoorden */}
                <div className="divide-y divide-gray-50">
                  {q.answers.map((a) => {
                    const answerKey = `${q.id}-${a.id}`
                    const isExpanded = expandedAnswer === answerKey
                    return (
                      <div key={a.id}>
                        <div className="px-5 py-3 flex items-center gap-3">
                          <span className="text-gray-300 text-xs">↳</span>
                          <input
                            value={a.text}
                            onChange={(e) =>
                              updateAnswer(q.id, a.id, {
                                text: e.target.value,
                              })
                            }
                            className="flex-1 text-sm text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                            placeholder="Antwoordtekst…"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-gray-400">→</span>
                            <select
                              value={a.nextQuestionId ?? ''}
                              onChange={(e) =>
                                updateAnswer(q.id, a.id, {
                                  nextQuestionId: e.target.value || null,
                                })
                              }
                              className={`border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-40 font-medium ${
                                a.nextQuestionId
                                  ? 'border-blue-200 text-blue-700 bg-blue-50'
                                  : 'border-green-200 text-green-700 bg-green-50'
                              }`}
                            >
                              <option value="">✓ Resultaten</option>
                              {flow.questions
                                .filter((oq) => oq.id !== q.id)
                                .map((oq) => (
                                  <option key={oq.id} value={oq.id}>
                                    {oq.text}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <button
                            onClick={() =>
                              setExpandedAnswer(
                                isExpanded ? null : answerKey
                              )
                            }
                            className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                              isExpanded
                                ? 'border-purple-300 bg-purple-50 text-purple-600'
                                : 'border-gray-200 text-gray-400 hover:border-purple-200 hover:text-purple-500'
                            }`}
                            title="Matchregels en producten"
                          >
                            {a.matchRules.length +
                              a.pinnedProductIds.length >
                            0
                              ? `⚙ ${
                                  a.matchRules.length +
                                  a.pinnedProductIds.length
                                }`
                              : '⚙'}
                          </button>
                          <button
                            onClick={() => removeAnswer(q.id, a.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                          >
                            ×
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="bg-gray-50 px-5 py-4 border-t border-gray-100 space-y-4">
                            {/* Afbeelding URL */}
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-2">Afbeelding</p>
                              <input
                                type="text"
                                value={a.imageUrl}
                                onChange={(e) => updateAnswer(q.id, a.id, { imageUrl: e.target.value })}
                                placeholder="https://…"
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                              />
                              {a.imageUrl && (
                                <img src={a.imageUrl} alt="" className="mt-2 h-14 w-14 object-contain rounded border border-gray-100" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-600">
                                  Matchregels (automatisch filteren)
                                </p>
                                <button
                                  onClick={() => addRule(q.id, a.id)}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  + Regel toevoegen
                                </button>
                              </div>
                              {a.matchRules.length === 0 && (
                                <p className="text-xs text-gray-400 italic">
                                  Geen regels — alle producten worden getoond.
                                </p>
                              )}
                              {a.matchRules.map((rule, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="flex items-center gap-2 mb-2"
                                >
                                  <select
                                    value={rule.field}
                                    onChange={(e) =>
                                      updateRule(q.id, a.id, rIdx, {
                                        field: e.target.value,
                                      })
                                    }
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                  >
                                    {FIELDS.map((f) => (
                                      <option key={f.value} value={f.value}>
                                        {f.label}
                                      </option>
                                    ))}
                                    <option value="custom">
                                      Aangepast veld…
                                    </option>
                                  </select>
                                  <select
                                    value={rule.operator}
                                    onChange={(e) =>
                                      updateRule(q.id, a.id, rIdx, {
                                        operator: e.target.value as MatchRule['operator'],
                                      })
                                    }
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                  >
                                    {OPERATORS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={rule.value}
                                    onChange={(e) =>
                                      updateRule(q.id, a.id, rIdx, {
                                        value: e.target.value,
                                      })
                                    }
                                    placeholder="waarde…"
                                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                  <button
                                    onClick={() =>
                                      removeRule(q.id, a.id, rIdx)
                                    }
                                    className="text-gray-300 hover:text-red-400 text-base"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-2">
                                Vastgepinde producten ({a.pinnedProductIds.length})
                              </p>
                              <input
                                type="text"
                                value={productSearch[answerKey] ?? ''}
                                onChange={(e) =>
                                  searchProducts(answerKey, e.target.value)
                                }
                                placeholder="Zoek product om vast te pinnen…"
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white mb-2"
                              />
                              {(productResults[answerKey] ?? []).map((p) => (
                                <div
                                  key={p._id}
                                  className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
                                >
                                  {p.imageLink && (
                                    <img
                                      src={p.imageLink}
                                      alt=""
                                      className="w-8 h-8 object-contain rounded border border-gray-100"
                                    />
                                  )}
                                  <span className="flex-1 text-xs text-gray-700 line-clamp-1">
                                    {p.title}
                                  </span>
                                  <button
                                    onClick={() =>
                                      togglePin(
                                        q.id,
                                        a.id,
                                        p._id,
                                        a.pinnedProductIds
                                      )
                                    }
                                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                      a.pinnedProductIds.includes(p._id)
                                        ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-500'
                                        : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                                    }`}
                                  >
                                    {a.pinnedProductIds.includes(p._id)
                                      ? '✓ Gepind'
                                      : '+ Pinnen'}
                                  </button>
                                </div>
                              ))}
                              {a.pinnedProductIds.length > 0 && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {a.pinnedProductIds.length} product(en) vastgepind.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="px-5 py-3 border-t border-gray-100">
                  <button
                    onClick={() => addAnswer(q.id)}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    + Antwoord toevoegen
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addQuestion}
            className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            + Vraag toevoegen
          </button>
        </>
      )}

      {/* ── Tab: Stroomschema ── */}
      {activeTab === 'schema' && (
        <FlowChart flow={flow} onEdit={() => setActiveTab('editor')} />
      )}

      {/* ── Tab: Voorbeeld ── */}
      {activeTab === 'preview' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              Live preview — sla eerst op om wijzigingen te zien.
            </p>
            <button
              onClick={() => setPreviewKey((k) => k + 1)}
              className="text-xs text-blue-600 hover:underline"
            >
              ↻ Vernieuwen
            </button>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <iframe
              key={previewKey}
              src={`/widget/${id}`}
              className="w-full"
              style={{ height: '600px', border: 'none' }}
              title="Keuzehulp voorbeeld"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Embed-URL: <code className="bg-gray-100 px-1 rounded">/widget/{id}</code>
          </p>
        </div>
      )}

      {/* ── Tab: Instellingen ── */}
      {activeTab === 'instellingen' && (
        <div className="space-y-5">

          {/* Beschikbaarheid */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Beschikbaarheid</h3>
            <p className="text-xs text-gray-400 mb-4">Producten die "op voorraad" zijn krijgen extra punten. Zet op 0 om uit te schakelen.</p>
            <label className="flex items-center justify-between text-sm text-gray-700">
              <span>Bonus bij "op voorraad"</span>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={500}
                  value={boost.availabilityBoost}
                  onChange={e => updateBoost({ availabilityBoost: Number(e.target.value) })}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <span className="text-xs text-gray-400">punten</span>
              </div>
            </label>
          </section>

          {/* Prijs */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Prijs</h3>
            <p className="text-xs text-gray-400 mb-4">Geef voorkeur aan de goedkoopste of duurste producten.</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm text-gray-700">
                <span>Voorkeur</span>
                <select
                  value={boost.pricePreference}
                  onChange={e => updateBoost({ pricePreference: e.target.value as BoostConfig['pricePreference'] })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none"
                >
                  <option value="none">Geen</option>
                  <option value="cheapest">Goedkoopste eerst</option>
                  <option value="mostExpensive">Duurste eerst</option>
                </select>
              </label>
              {boost.pricePreference !== 'none' && (
                <label className="flex items-center justify-between text-sm text-gray-700">
                  <span>Max. bonus</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={500}
                      value={boost.priceBoost}
                      onChange={e => updateBoost({ priceBoost: Number(e.target.value) })}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <span className="text-xs text-gray-400">punten</span>
                  </div>
                </label>
              )}
            </div>
          </section>

          {/* Marge */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Marge per product</h3>
            <p className="text-xs text-gray-400 mb-4">Producten met een hogere marge scoren hoger. Geef de naam van het numerieke attribuut in de productfeed op.</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm text-gray-700">
                <span>Attribuutnaam</span>
                <input
                  type="text"
                  value={boost.marginField}
                  onChange={e => updateBoost({ marginField: e.target.value })}
                  placeholder="bijv. marge_pct"
                  className="w-40 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </label>
              {boost.marginField && (
                <label className="flex items-center justify-between text-sm text-gray-700">
                  <span>Max. bonus</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={500}
                      value={boost.marginBoost}
                      onChange={e => updateBoost({ marginBoost: Number(e.target.value) })}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <span className="text-xs text-gray-400">punten</span>
                  </div>
                </label>
              )}
            </div>
          </section>

          {/* SKU-boost */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-800">SKU-boost</h3>
              <button
                onClick={() => updateBoost({ skuBoosts: [...(boost.skuBoosts ?? []), { sku: '', points: 50 }] })}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + SKU toevoegen
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Specifieke producten (op SKU) altijd extra punten geven, ongeacht de antwoorden van de gebruiker.</p>
            {(boost.skuBoosts ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 italic">Geen SKU-boosts ingesteld.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 text-xs text-gray-400 mb-1 px-1">
                  <span className="flex-1">SKU-code</span>
                  <span className="w-20 text-center">Punten</span>
                  <span className="w-5" />
                </div>
                {(boost.skuBoosts ?? []).map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={entry.sku}
                      onChange={e => {
                        const next = [...boost.skuBoosts]
                        next[i] = { ...entry, sku: e.target.value }
                        updateBoost({ skuBoosts: next })
                      }}
                      placeholder="SKU-code…"
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      type="number" min={1} max={9999}
                      value={entry.points}
                      onChange={e => {
                        const next = [...boost.skuBoosts]
                        next[i] = { ...entry, points: Number(e.target.value) }
                        updateBoost({ skuBoosts: next })
                      }}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button
                      onClick={() => updateBoost({ skuBoosts: boost.skuBoosts.filter((_, j) => j !== i) })}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none"
                      title="Verwijderen"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Adobe Commerce */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Adobe Commerce</h3>
            <p className="text-xs text-gray-400 mb-4">
              Vul de store-URL in om een "In winkelwagen"-knop te tonen in de widget.
              Stel <code className="bg-gray-100 px-1 rounded">ADOBE_COMMERCE_TOKEN</code> in via <code className="bg-gray-100 px-1 rounded">.env.local</code>.
            </p>
            <label className="flex items-center justify-between text-sm text-gray-700">
              <span>Store-URL</span>
              <input
                type="url"
                value={flow.adobeCommerceUrl ?? ''}
                onChange={e => update(f => ({ ...f, adobeCommerceUrl: e.target.value }))}
                placeholder="https://mystore.com"
                className="w-56 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>
          </section>

          <button
            onClick={() => save(flow)}
            disabled={saving}
            className="w-full bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Opslaan…' : saved ? '✓ Opgeslagen' : 'Instellingen opslaan'}
          </button>
        </div>
      )}

      {/* ── Tab: Statistieken ── */}
      {activeTab === 'statistieken' && (
        <StatistiekenTab flowId={id} />
      )}

      {activeTab === 'embed' && (
        <EmbedTab flowId={id} flowName={flow.name} />
      )}
    </div>
  )
}
