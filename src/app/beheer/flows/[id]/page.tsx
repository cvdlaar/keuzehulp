'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

interface MatchRule {
  field: string
  operator: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'startsWith' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string
}

interface MaatwerkField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'file'
  required: boolean
  placeholder: string
}

interface Answer {
  id: string
  text: string
  label: string
  info: string
  imageUrl: string
  nextQuestionId: string | null
  matchRules: MatchRule[]
  pinnedProductIds: string[]
  relatedRules: MatchRule[]
  relatedPinnedIds: string[]
  maatwerkMode: boolean
}

type AnswerLayout = 'text' | 'image' | 'image-text' | 'size'

interface Question {
  id: string
  text: string
  intro: string
  type: 'single' | 'multi' | 'range'
  layout: AnswerLayout
  imageColumns: 2 | 3 | 4
  answers: Answer[]
  rangeField: string
  rangeUnit: string
  rangeMin: number
  rangeMax: number
  rangeStep: number
  rangeStrictFilter: boolean
  rangeNextQuestionId: string | null
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

type BorderRadius = 'none' | 'small' | 'medium' | 'large'

interface WidgetStyle {
  primaryColor: string
  borderRadius: BorderRadius
  fontFamily: string
}

const DEFAULT_WIDGET_STYLE: WidgetStyle = {
  primaryColor: '#2563eb',
  borderRadius: 'medium',
  fontFamily: '',
}

interface WidgetBehavior {
  enableAnimations: boolean
  rememberAnswers: boolean
  progressStyle: 'bar' | 'steps'
  showProductReviews: boolean
  showShopRating: boolean
}

const DEFAULT_BEHAVIOR: WidgetBehavior = {
  enableAnimations: true,
  rememberAnswers: false,
  progressStyle: 'bar',
  showProductReviews: false,
  showShopRating: false,
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
  widgetStyle?: WidgetStyle
  widgetBehavior?: WidgetBehavior
  emailResults?: boolean
  emailSubject?: string
  spotlerAttributes?: Record<string, string>
  resultsSummaryTemplate?: string
  resultsTitle?: string
  displayAttributes?: string[]
  maatwerkTitle?: string
  maatwerkIntro?: string
  maatwerkEmailTo?: string
  maatwerkFields?: MaatwerkField[]
  maatwerkIncludeAddress?: boolean
}

interface ProductHit {
  _id: string
  title: string
  brand: string
  imageLink: string
  externalId: string
}

const OPERATORS = [
  { value: 'contains',    label: 'bevat' },
  { value: 'notContains', label: 'bevat niet' },
  { value: 'equals',      label: 'is gelijk aan' },
  { value: 'notEquals',   label: 'is niet gelijk aan' },
  { value: 'startsWith',  label: 'begint met' },
  { value: 'gt',          label: '> groter dan' },
  { value: 'gte',         label: '≥ groter/gelijk aan' },
  { value: 'lt',          label: '< kleiner dan' },
  { value: 'lte',         label: '≤ kleiner/gelijk aan' },
]

const FIELDS = [
  { value: 'category',         label: 'Categorie' },
  { value: 'brand',            label: 'Merk' },
  { value: 'title',            label: 'Titel' },
  { value: 'availability',     label: 'Beschikbaarheid' },
  { value: 'shortDescription', label: 'Korte omschrijving' },
  { value: 'description',      label: 'Omschrijving' },
  { value: 'price',            label: 'Prijs' },
  { value: 'salePrice',        label: 'Actieprijs' },
  { value: 'lowestPrice',      label: 'Staffelprijs' },
  { value: 'sku',              label: 'SKU' },
  { value: 'ean',              label: 'EAN' },
]

const FIELD_VALUES = new Set(FIELDS.map(f => f.value))

// ── Afbeelding upload veld ───────────────────────────────────────────────────

function ImageUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError('')
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    setUploading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Upload mislukt')
      return
    }
    const { url } = await res.json()
    onChange(url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2">Afbeelding</p>
      <div className="flex gap-2">
        {/* URL-veld */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… of upload →"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        />
        {/* Upload knop */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploaden…' : '↑ Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {/* Drag & drop zone (alleen zichtbaar als er nog geen afbeelding is) */}
      {!value && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="mt-2 border-2 border-dashed border-gray-200 rounded-lg py-4 text-center text-xs text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
        >
          Sleep een afbeelding hierheen of klik om te uploaden
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {value && (
        <div className="mt-2 flex items-center gap-2">
          <img src={value} alt="" className="h-16 w-16 object-contain rounded border border-gray-100 bg-gray-50" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Verwijderen
          </button>
        </div>
      )}
    </div>
  )
}

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
    const nexts = [...new Set([
      ...entry.q.answers.filter(a => !a.maatwerkMode).map(a => a.nextQuestionId).filter((x): x is string => x !== null),
      ...(entry.q.rangeNextQuestionId ? [entry.q.rangeNextQuestionId] : []),
    ])]
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

  // ── 3. Uitkomst-knopen (Resultaten + Maatwerk) ──────────
  const maxRow = Math.max(0, ...rowOf.values())
  const bottomY = (maxRow + 1) * RS + PAD

  const hasResults  = flow.questions.some(q => q.answers.some(a => a.nextQuestionId === null && !a.maatwerkMode))
  const hasMaatwerk = flow.questions.some(q => q.answers.some(a => a.maatwerkMode))

  // Knopen naast elkaar centreren
  const bottomCount = (hasResults ? 1 : 0) + (hasMaatwerk ? 1 : 0)
  const gap = 24
  const bottomTotalW = bottomCount * NW + (bottomCount - 1) * gap
  const bottomStartX = svgW / 2 - bottomTotalW / 2
  const resultsX  = hasResults  ? bottomStartX                                    : -9999
  const maatwerkX = hasMaatwerk ? bottomStartX + (hasResults ? NW + gap : 0)     : -9999

  const hasBottom = hasResults || hasMaatwerk
  const svgH = (hasBottom ? bottomY + NH : maxRow * RS + NH) + PAD

  // ── 4. Pijlen ────────────────────────────────────────────
  interface Arrow { fromId: string; toId: string | null; label: string; hasRules: boolean; isMaatwerk: boolean }
  const arrows: Arrow[] = []
  flow.questions.forEach(q =>
    q.answers.forEach(a =>
      arrows.push({
        fromId: q.id,
        toId: a.maatwerkMode ? null : a.nextQuestionId,
        label: a.text,
        hasRules: a.matchRules.length + a.pinnedProductIds.length > 0,
        isMaatwerk: !!a.maatwerkMode,
      })
    )
  )

  // Voor range-vragen: één pijl vanuit rangeNextQuestionId
  flow.questions.forEach(q => {
    if (q.type === 'range' && q.rangeNextQuestionId !== null) {
      arrows.push({ fromId: q.id, toId: q.rangeNextQuestionId ?? null, label: '', hasRules: false, isMaatwerk: false })
    } else if (q.type === 'range' && q.rangeNextQuestionId === null) {
      arrows.push({ fromId: q.id, toId: null, label: '', hasRules: false, isMaatwerk: false })
    }
  })

  const nodeBtm = (id: string) => { const p = posOf.get(id); return p ? { x: p.x + NW / 2, y: p.y + NH } : null }
  const nodeTop = (id: string) => { const p = posOf.get(id); return p ? { x: p.x + NW / 2, y: p.y } : null }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 overflow-auto">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: 'block', minWidth: 320, maxHeight: '80vh' }}>
        <defs>
          <marker id="ah-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#93c5fd" />
          </marker>
          <marker id="ah-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#4ade80" />
          </marker>
          <marker id="ah-teal" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#2dd4bf" />
          </marker>
        </defs>

        {/* Pijlen */}
        {arrows.map((arrow, i) => {
          const from = nodeBtm(arrow.fromId)
          if (!from) return null
          let toX: number, toY: number
          let isResult = false, isMaatwerk = false

          if (arrow.toId) {
            const to = nodeTop(arrow.toId)
            if (!to) return null
            toX = to.x; toY = to.y
          } else if (arrow.isMaatwerk) {
            toX = maatwerkX + NW / 2; toY = bottomY; isMaatwerk = true
          } else {
            toX = resultsX + NW / 2; toY = bottomY; isResult = true
          }

          const stroke = isMaatwerk ? '#2dd4bf' : isResult ? '#4ade80' : '#93c5fd'
          const marker = isMaatwerk ? 'url(#ah-teal)' : isResult ? 'url(#ah-green)' : 'url(#ah-blue)'
          const borderColor = isMaatwerk ? '#99f6e4' : isResult ? '#bbf7d0' : '#bfdbfe'

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
              <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" markerEnd={marker} />
              {lbl && (
                <g>
                  <rect x={lx - lblW / 2} y={ly - 9} width={lblW} height={15} rx={3}
                    fill="white" fillOpacity="0.9" stroke={borderColor} strokeWidth="1" />
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
          const isRange = q.type === 'range'
          const title = `V${entry.index + 1}${isRange ? ' ↔' : ''}`
          const sub = q.text.length > 24 ? q.text.slice(0, 23) + '…' : q.text

          return (
            <g key={q.id}>
              <rect x={pos.x + 2} y={pos.y + 3} width={NW} height={NH} rx={9} fill="#00000010" />
              <rect x={pos.x} y={pos.y} width={NW} height={NH} rx={9}
                fill={isStart ? '#eff6ff' : '#ffffff'}
                stroke={isStart ? '#3b82f6' : '#bfdbfe'}
                strokeWidth={isStart ? 2 : 1.5} />
              {isStart && (
                <g>
                  <rect x={pos.x + 8} y={pos.y + 7} width={34} height={14} rx={4} fill="#3b82f6" />
                  <text x={pos.x + 25} y={pos.y + 18} textAnchor="middle" fontSize="8"
                    fill="white" fontWeight="bold" fontFamily="system-ui, sans-serif">START</text>
                </g>
              )}
              <text x={pos.x + NW / 2} y={pos.y + (isStart ? 34 : 26)}
                textAnchor="middle" fontSize="12" fontWeight="700"
                fill={isStart ? '#1d4ed8' : '#1e40af'} fontFamily="system-ui, sans-serif">
                {title}
              </text>
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
            <rect x={resultsX + 2} y={bottomY + 3} width={NW} height={NH} rx={9} fill="#00000010" />
            <rect x={resultsX} y={bottomY} width={NW} height={NH} rx={9}
              fill="#f0fdf4" stroke="#22c55e" strokeWidth={2} />
            <text x={resultsX + NW / 2} y={bottomY + NH / 2 + 5}
              textAnchor="middle" fontSize="13" fontWeight="700"
              fill="#15803d" fontFamily="system-ui, sans-serif">
              ✓ Resultaten
            </text>
          </g>
        )}

        {/* Maatwerk-knoop */}
        {hasMaatwerk && (
          <g>
            <rect x={maatwerkX + 2} y={bottomY + 3} width={NW} height={NH} rx={9} fill="#00000010" />
            <rect x={maatwerkX} y={bottomY} width={NW} height={NH} rx={9}
              fill="#f0fdfa" stroke="#14b8a6" strokeWidth={2} />
            <text x={maatwerkX + NW / 2} y={bottomY + NH / 2 - 3}
              textAnchor="middle" fontSize="13" fontWeight="700"
              fill="#0f766e" fontFamily="system-ui, sans-serif">
              ✉ Maatwerk
            </text>
            <text x={maatwerkX + NW / 2} y={bottomY + NH / 2 + 13}
              textAnchor="middle" fontSize="9" fill="#5eead4" fontFamily="system-ui, sans-serif">
              formulier
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

type StatPeriod = '7d' | '30d' | '90d' | 'custom'

interface AnalyticsData {
  totalSessions: number
  completions: number
  noResults: number
  maatwerkShownCount: number
  maatwerkCount: number
  completionRate: number
  noResultsRate: number
  questions: { text: string; impressions: number; answers: { id: string; text: string; count: number }[] }[]
  recommendedProducts: { productId: string; title: string; shown: number; perfectShown: number }[]
  productClicks: { productId: string; title: string; count: number }[]
  addToCarts: { productId: string; title: string; count: number }[]
  dailySessions: { date: string; count: number }[]
  dailyResults:  { date: string; count: number }[]
  dailyClicks:   { date: string; count: number }[]
  dailyMaatwerk: { date: string; count: number }[]
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

type FlowSeriesKey = 'sessions' | 'results' | 'clicks' | 'maatwerk'

const FLOW_SERIES: { key: FlowSeriesKey; label: string; color: string }[] = [
  { key: 'sessions',  label: 'Sessies',            color: '#60a5fa' },
  { key: 'results',   label: 'Resultaten getoond',  color: '#34d399' },
  { key: 'clicks',    label: 'Productklikken',      color: '#f59e0b' },
  { key: 'maatwerk',  label: 'Maatwerkverzoeken',   color: '#a78bfa' },
]

function FlowMultiChart({ data, activeSeries, onToggle }: {
  data: AnalyticsData
  activeSeries: Set<FlowSeriesKey>
  onToggle: (k: FlowSeriesKey) => void
}) {
  const seriesData: Record<FlowSeriesKey, { date: string; count: number }[]> = {
    sessions:  data.dailySessions,
    results:   data.dailyResults,
    clicks:    data.dailyClicks,
    maatwerk:  data.dailyMaatwerk,
  }

  const allValues = FLOW_SERIES
    .filter(s => activeSeries.has(s.key))
    .flatMap(s => seriesData[s.key].map(d => d.count))
  const max = Math.max(...allValues, 1)

  const dates = data.dailySessions.map(d => d.date)
  const step = Math.max(1, Math.floor(dates.length / 6))

  const fmt = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate()} ${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][dt.getMonth()]}`
  }

  return (
    <div>
      {/* Serie-toggles */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {FLOW_SERIES.map(s => (
          <button key={s.key} onClick={() => onToggle(s.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              activeSeries.has(s.key) ? 'border-transparent text-white' : 'border-gray-200 text-gray-400 bg-white'
            }`}
            style={activeSeries.has(s.key) ? { backgroundColor: s.color, borderColor: s.color } : {}}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Grafiek */}
      <div className="flex items-end gap-px" style={{ height: 80 }}>
        {dates.map((date, i) => (
          <div key={date} className="flex-1 flex flex-col justify-end gap-px group relative h-full">
            {FLOW_SERIES.filter(s => activeSeries.has(s.key)).map(s => {
              const val = seriesData[s.key][i]?.count ?? 0
              const h = max > 0 ? Math.max((val / max) * 72, val > 0 ? 2 : 0) : 0
              return <div key={s.key} style={{ height: h, backgroundColor: s.color, borderRadius: '2px 2px 0 0' }} />
            })}
            <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1.5 rounded whitespace-nowrap z-10 space-y-0.5">
              <p className="font-semibold border-b border-white/20 pb-0.5 mb-0.5">{fmt(date)}</p>
              {FLOW_SERIES.filter(s => activeSeries.has(s.key)).map(s => (
                <p key={s.key} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  {s.label}: {seriesData[s.key][i]?.count ?? 0}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Datum-as */}
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

function StatistiekenTab({ flowId }: { flowId: string }) {
  const [period, setPeriod] = useState<StatPeriod>('30d')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSeries, setActiveSeries] = useState<Set<FlowSeriesKey>>(new Set(['sessions', 'results']))

  const toggleSeries = (key: FlowSeriesKey) => {
    setActiveSeries(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) } else next.add(key)
      return next
    })
  }

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (period !== 'custom') {
      const days = { '7d': 7, '30d': 30, '90d': 90 }[period]
      params.set('from', new Date(Date.now() - days * 86400000).toISOString())
      params.set('to', new Date().toISOString())
    } else {
      if (fromDate) params.set('from', new Date(fromDate).toISOString())
      if (toDate)   params.set('to', new Date(toDate + 'T23:59:59').toISOString())
    }
    fetch(`/api/flows/${flowId}/analytics?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [flowId, period, fromDate, toDate])

  const PERIODS: { key: StatPeriod; label: string }[] = [
    { key: '7d',     label: '7 dagen' },
    { key: '30d',    label: '30 dagen' },
    { key: '90d',    label: '90 dagen' },
    { key: 'custom', label: 'Aangepast' },
  ]

  return (
    <div className="space-y-5">
      {/* Periode-selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                period === p.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <span className="text-xs text-gray-400">t/m</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Laden…</p>}
      {!loading && !data && <p className="text-sm text-red-400">Kon statistieken niet laden.</p>}
      {!loading && data && <>

      {/* Tijdsgrafiek */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-800 mb-4">Verloop door de tijd</p>
        <FlowMultiChart data={data} activeSeries={activeSeries} onToggle={toggleSeries} />
      </div>

      {/* Overzicht */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Sessies',              value: data.totalSessions },
          { label: 'Afgerond',             value: `${data.completions} (${data.completionRate}%)` },
          { label: 'Geen resultaten',      value: `${data.noResults} (${data.noResultsRate}%)` },
          { label: 'Maatwerk getoond',     value: data.maatwerkShownCount },
          { label: 'Maatwerk verstuurd',   value: data.maatwerkCount },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Producten funnel — altijd tonen, ook als alleen klikken */}
      {(() => {
        const clickMap = Object.fromEntries(data.productClicks.map(p => [p.productId, p.count]))
        const cartMap  = Object.fromEntries(data.addToCarts.map(p => [p.productId, p.count]))
        const allIds   = new Set([
          ...data.recommendedProducts.map(p => p.productId),
          ...data.productClicks.map(p => p.productId),
          ...data.addToCarts.map(p => p.productId),
        ])

        if (allIds.size === 0) return (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center text-xs text-gray-400 italic">
            Nog geen producten vertoond of geklikt in deze periode. De keuzehulp moet de resultaten tonen voordat hier data verschijnt.
          </div>
        )

        const titleMap   = Object.fromEntries([
          ...data.recommendedProducts.map(p => [p.productId, p.title]),
          ...data.productClicks.map(p => [p.productId, p.title]),
          ...data.addToCarts.map(p => [p.productId, p.title]),
        ])
        const shownMap   = Object.fromEntries(data.recommendedProducts.map(p => [p.productId, p.shown]))
        const perfectMap = Object.fromEntries(data.recommendedProducts.map(p => [p.productId, p.perfectShown]))

        const rows = [...allIds].map(id => ({
          productId: id,
          title:  titleMap[id] || id,
          shown:  shownMap[id]   ?? 0,
          perfect: perfectMap[id] ?? 0,
          clicks: clickMap[id]   ?? 0,
          carts:  cartMap[id]    ?? 0,
        })).sort((a, b) => b.shown - a.shown || b.clicks - a.clicks)

        const maxShown = Math.max(...rows.map(r => r.shown), 1)

        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">Producten</p>
              <p className="text-xs text-gray-400">{rows.length} product{rows.length !== 1 ? 'en' : ''}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 font-medium text-right w-20">Getoond</th>
                    <th className="px-4 py-2 font-medium text-right w-16">Top</th>
                    <th className="px-4 py-2 font-medium text-right w-16">Klikken</th>
                    <th className="px-4 py-2 font-medium text-right w-16">CTR</th>
                    <th className="px-4 py-2 font-medium text-right w-20">Winkelwagen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(r => {
                    const ctr    = r.shown > 0 ? Math.round((r.clicks / r.shown) * 100) : 0
                    const barPct = Math.round((r.shown / maxShown) * 100)
                    return (
                      <tr key={r.productId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800 truncate max-w-56">{r.title}</div>
                          <div className="mt-1 h-1 bg-gray-100 rounded-full w-full">
                            <div className="h-1 bg-blue-300 rounded-full" style={{ width: `${barPct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{r.shown || '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          {r.perfect > 0 ? <span className="text-blue-600 font-medium">{r.perfect}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {r.clicks > 0 ? <span className="text-gray-800 font-semibold">{r.clicks}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {r.shown > 0
                            ? <span className={ctr >= 20 ? 'text-green-600 font-medium' : ctr >= 10 ? 'text-yellow-600' : 'text-gray-400'}>{ctr}%</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {r.carts > 0 ? <span className="text-green-600 font-medium">{r.carts}</span> : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">CTR = klikken ÷ getoond. Top = als beste match aanbevolen.</p>
            </div>
          </div>
        )
      })()}

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


      {data.totalSessions === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-8">
          Geen data in de geselecteerde periode.
        </p>
      )}
      </>}
    </div>
  )
}

// ── Embed tab ────────────────────────────────────────────────────────────────

type EmbedMode = 'inline' | 'popup' | 'slide-in'
type SlidePosition = 'right' | 'left'

function buildMsgHandler(flowId: string, withResize: boolean) {
  return `
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'keuzehulp') return;
    ${withResize ? `if (e.data.type === 'resize' && e.data.height) {
      var iframe = document.getElementById('keuzehulp-${flowId}-iframe');
      if (iframe) iframe.style.height = (e.data.height + 40) + 'px';
    }` : ''}
    if (e.data.type === 'event') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'keuzehulp_' + e.data.eventType, keuzehulp_flow: '${flowId}', keuzehulp_data: e.data });
    }
    if (e.data.type === 'completed' && e.data.preferences) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'keuzehulp_completed', keuzehulp_flow_id: e.data.flowId, keuzehulp_flow_name: e.data.flowName, keuzehulp_preferences: e.data.preferences });
      if (typeof _spq !== 'undefined' && e.data.spotlerAttributes) {
        Object.keys(e.data.spotlerAttributes).forEach(function(a) { _spq('set', a, e.data.spotlerAttributes[a]); });
        _spq('event', 'keuzehulp_completed', { flow: e.data.flowName });
      }
    }
    if (e.data.type === 'add_to_cart') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'keuzehulp_add_to_cart', ecommerce: { add: { products: [{ id: e.data.sku, quantity: 1 }] } } });
    }
  });`
}

function buildSnippet(mode: EmbedMode, buttonText: string, position: SlidePosition, serverUrl: string, flowId: string, flowName: string, primaryColor: string, customTrigger: string) {
  const src = `${serverUrl}/widget/${flowId}`
  const iframeBase = `id="keuzehulp-${flowId}-iframe" src="${src}" style="width:100%;border:none;display:block;" scrolling="no"`
  const closeBtn = (extra = '') => `<button onclick="keuzehulp_${flowId}_close()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;color:#6b7280;line-height:1;z-index:1;" aria-label="Sluiten"${extra}>✕</button>`

  if (mode === 'inline') return `<!-- Keuzehulp: ${flowName} -->
<div id="keuzehulp-${flowId}"></div>
<script>
(function(){
  var el = document.getElementById('keuzehulp-${flowId}');
  var iframe = document.createElement('iframe');
  iframe.id = 'keuzehulp-${flowId}-iframe';
  iframe.src = '${src}';
  iframe.style.cssText = 'width:100%;height:600px;border:none;display:block;';
  iframe.scrolling = 'no';
  el.appendChild(iframe);
  ${buildMsgHandler(flowId, true)}
})();
<\/script>`

  if (mode === 'popup') return `<!-- Keuzehulp: ${flowName} — Popup -->
<button onclick="keuzehulp_${flowId}_open()" style="padding:12px 22px;background:${primaryColor};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
  ${buttonText}
</button>

<div id="keuzehulp-${flowId}-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center;padding:16px;">
  <div style="position:relative;background:#fff;border-radius:16px;width:100%;max-width:640px;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);">
    ${closeBtn()}
    <iframe ${iframeBase} style="width:100%;height:70vh;border:none;display:block;border-radius:16px;"></iframe>
  </div>
</div>

<script>
function keuzehulp_${flowId}_open() {
  var o = document.getElementById('keuzehulp-${flowId}-overlay');
  o.style.display = 'flex';
}
function keuzehulp_${flowId}_close() {
  document.getElementById('keuzehulp-${flowId}-overlay').style.display = 'none';
}
document.getElementById('keuzehulp-${flowId}-overlay').addEventListener('click', function(e) {
  if (e.target === this) keuzehulp_${flowId}_close();
});
${buildMsgHandler(flowId, false)}
<\/script>`

  // slide-in
  const side = position === 'right' ? 'right' : 'left'
  const shadow = position === 'right' ? '-4px 0 24px' : '4px 0 24px'
  const useCustom = customTrigger.trim() !== ''

  const floatingBtn = useCustom ? '' : `<button id="keuzehulp-${flowId}-btn" onclick="keuzehulp_${flowId}_open()"
  style="position:fixed;${side}:24px;bottom:24px;z-index:9998;padding:14px 22px;background:${primaryColor};color:#fff;border:none;border-radius:50px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);">
  ${buttonText}
</button>
`

  const openFn = useCustom
    ? `function keuzehulp_${flowId}_open() {
  document.getElementById('keuzehulp-${flowId}-panel').style.${side} = '0';
}`
    : `function keuzehulp_${flowId}_open() {
  document.getElementById('keuzehulp-${flowId}-btn').style.display = 'none';
  document.getElementById('keuzehulp-${flowId}-panel').style.${side} = '0';
}`

  const closeFn = useCustom
    ? `function keuzehulp_${flowId}_close() {
  document.getElementById('keuzehulp-${flowId}-panel').style.${side} = '-440px';
}`
    : `function keuzehulp_${flowId}_close() {
  document.getElementById('keuzehulp-${flowId}-panel').style.${side} = '-440px';
  setTimeout(function(){ document.getElementById('keuzehulp-${flowId}-btn').style.display = ''; }, 300);
}`

  const triggerBind = useCustom
    ? `document.addEventListener('DOMContentLoaded', function() {
  var triggers = document.querySelectorAll('${customTrigger.trim()}');
  triggers.forEach(function(el) { el.addEventListener('click', keuzehulp_${flowId}_open); });
});`
    : ''

  return `<!-- Keuzehulp: ${flowName} — Slide-in${useCustom ? ` (trigger: ${customTrigger.trim()})` : ''} -->
${floatingBtn}<div id="keuzehulp-${flowId}-panel"
  style="position:fixed;top:0;${side}:-440px;width:440px;max-width:100vw;height:100%;background:#fff;z-index:9999;box-shadow:${shadow} rgba(0,0,0,.15);transition:${side} .3s ease;overflow:hidden;">
  ${closeBtn(` style="position:absolute;top:10px;${position === 'right' ? 'left' : 'right'}:14px;background:none;border:none;font-size:22px;cursor:pointer;color:#6b7280;line-height:1;z-index:1;"`)}
  <iframe ${iframeBase} style="width:100%;height:100%;border:none;display:block;"></iframe>
</div>

<script>
${openFn}
${closeFn}
${triggerBind}
${buildMsgHandler(flowId, false)}
<\/script>`
}

function EmbedTab({ flowId, flowName, primaryColor }: { flowId: string; flowName: string; primaryColor: string }) {
  const [mode, setMode] = useState<EmbedMode>('inline')
  const [buttonText, setButtonText] = useState('Start de keuzehulp')
  const [position, setPosition] = useState<SlidePosition>('right')
  const [customTrigger, setCustomTrigger] = useState('')
  const [copied, setCopied] = useState(false)
  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const snippet = buildSnippet(mode, buttonText, position, serverUrl, flowId, flowName, primaryColor, customTrigger)

  const copy = () => {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const MODES: { key: EmbedMode; label: string; desc: string }[] = [
    { key: 'inline',   label: 'Inline',    desc: 'Geplaatst op de pagina' },
    { key: 'popup',    label: 'Popup',     desc: 'Knop opent een modal' },
    { key: 'slide-in', label: 'Slide-in',  desc: 'Drijvende knop + zijpaneel' },
  ]

  return (
    <div className="space-y-5">

      {/* Modus */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Weergave</h3>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`rounded-xl border-2 px-3 py-3 text-left transition-colors ${
                mode === m.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <p className={`text-sm font-medium ${mode === m.key ? 'text-blue-700' : 'text-gray-800'}`}>{m.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Knoptekst (voor popup + slide-in) */}
        {mode !== 'inline' && (
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between text-sm text-gray-700">
              <span>Knoptekst</span>
              <input
                value={buttonText}
                onChange={e => setButtonText(e.target.value)}
                className="w-64 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>
            {mode === 'slide-in' && (
              <>
                <label className="flex items-center justify-between text-sm text-gray-700">
                  <span>Paneel opent van</span>
                  <div className="flex gap-2">
                    {(['right', 'left'] as SlidePosition[]).map(p => (
                      <button key={p} onClick={() => setPosition(p)}
                        className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                          position === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'
                        }`}>
                        {p === 'right' ? 'Rechts' : 'Links'}
                      </button>
                    ))}
                  </div>
                </label>
                <div>
                  <label className="flex items-center justify-between text-sm text-gray-700">
                    <span>Bestaand element als trigger</span>
                    <input
                      value={customTrigger}
                      onChange={e => setCustomTrigger(e.target.value)}
                      placeholder="#open-keuzehulp"
                      className="w-48 border border-gray-200 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </label>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {customTrigger.trim()
                      ? <>De embed genereert geen drijvende knop — elk element dat overeenkomt met <code className="bg-gray-100 px-1 rounded">{customTrigger}</code> opent het paneel.</>
                      : 'Laat leeg voor een automatisch gegenereerde drijvende knop.'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Snippet */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500 font-mono">HTML / GTM Custom HTML</span>
          <button onClick={copy}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
              copied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}>
            {copied ? '✓ Gekopieerd' : 'Kopieer'}
          </button>
        </div>
        <pre className="text-xs text-gray-700 p-4 overflow-auto leading-relaxed max-h-80">{snippet}</pre>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-xs text-gray-400 space-y-1.5">
        <p><strong className="text-gray-600">Inline</strong> — zet de <code className="bg-gray-100 px-1 rounded">&lt;div&gt;</code> op de plek waar de widget moet komen.</p>
        <p><strong className="text-gray-600">Popup</strong> — de knop staat inline; de modal verschijnt gecentreerd over de pagina.</p>
        <p><strong className="text-gray-600">Slide-in</strong> — de knop zweeft rechts/links onderaan; het paneel schuift open. Plaatsing van de code maakt niet uit.</p>
        <p className="pt-1 border-t border-gray-100"><strong className="text-gray-600">Spotler Activate</strong> — de code bevat al de <code className="bg-gray-100 px-1 rounded">_spq</code>-aanroepen. Attribuutnamen instelbaar via Instellingen → Spotler Activate.</p>
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
  const [collapsedQuestions, setCollapsedQuestions] = useState<Set<string>>(new Set())
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState<Record<string, string>>({})
  const [productResults, setProductResults] = useState<Record<string, ProductHit[]>>({})
  const [availableFields, setAvailableFields] = useState<string[]>([])
  const [matchCounts, setMatchCounts] = useState<Record<string, number | null>>({})

  useEffect(() => {
    fetch(`/api/flows/${id}`)
      .then((r) => r.json())
      .then((d) => setFlow(d))
  }, [id])

  useEffect(() => {
    fetch('/api/products/fields')
      .then((r) => r.json())
      .then((d) => setAvailableFields(d.fields ?? []))
  }, [])

  const save = async (flowData: Flow) => {
    setSaving(true)
    const res = await fetch(`/api/flows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flowData),
    })
    const saved = await res.json()
    setFlow(saved)
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
        { id: newId, text: '', intro: '', type: 'single', layout: 'text', imageColumns: 2, answers: [], rangeField: '', rangeUnit: '', rangeMin: 0, rangeMax: 1000, rangeStep: 1, rangeStrictFilter: false, rangeNextQuestionId: null },
      ],
      startQuestionId: f.questions.length === 0 ? newId : f.startQuestionId,
    }))
    setCollapsedQuestions(prev => { const next = new Set(prev); next.delete(newId); return next })
    setFocusQuestionId(newId)
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
                  label: '',
                  info: '',
                  imageUrl: '',
                  nextQuestionId: null,
                  matchRules: [],
                  pinnedProductIds: [],
                  relatedRules: [],
                  relatedPinnedIds: [],
                  maatwerkMode: false,
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

  // ── Product count preview ────────────────────────────────
  const countMatchProducts = async (answerKey: string, matchRules: MatchRule[], pinnedProductIds: string[]) => {
    setMatchCounts(c => ({ ...c, [answerKey]: null }))
    const res = await fetch(`/api/flows/${id}/match/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchRules, pinnedProductIds }),
    })
    const { count } = await res.json()
    setMatchCounts(c => ({ ...c, [answerKey]: count }))
  }

  // ── Bijproducten regels ──────────────────────────────────
  const addRelatedRule = (qId: string, aId: string) => {
    const newRule: MatchRule = { field: 'category', operator: 'contains', value: '' }
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId
                  ? { ...a, relatedRules: [...(a.relatedRules ?? []), newRule] }
                  : a
              ),
            }
          : q
      ),
    }))
  }

  const updateRelatedRule = (qId: string, aId: string, rIdx: number, patch: Partial<MatchRule>) => {
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId
                  ? { ...a, relatedRules: (a.relatedRules ?? []).map((r, i) => i === rIdx ? { ...r, ...patch } : r) }
                  : a
              ),
            }
          : q
      ),
    }))
  }

  const removeRelatedRule = (qId: string, aId: string, rIdx: number) => {
    update((f) => ({
      ...f,
      questions: f.questions.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId
                  ? { ...a, relatedRules: (a.relatedRules ?? []).filter((_, i) => i !== rIdx) }
                  : a
              ),
            }
          : q
      ),
    }))
  }

  const toggleRelatedPin = (qId: string, aId: string, productId: string, currentPins: string[]) => {
    const next = currentPins.includes(productId)
      ? currentPins.filter((p) => p !== productId)
      : [...currentPins, productId]
    updateAnswer(qId, aId, { relatedPinnedIds: next })
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

      {/* Datalist voor veldnamen — gedeeld door alle matchregel-inputs */}
      <datalist id="product-fields-list">
        {availableFields.map((f) => <option key={f} value={f} />)}
      </datalist>

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

          <div className="flex justify-end mb-2">
            <button
              onClick={addQuestion}
              className="text-xs text-blue-600 font-medium flex items-center gap-1 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              + Vraag toevoegen
            </button>
          </div>

          <div className="space-y-4">
            {flow.questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Vraag header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {qIdx + 1}
                  </span>
                  <input
                    ref={el => { if (el && focusQuestionId === q.id) { el.focus(); setFocusQuestionId(null) } }}
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                    placeholder="Vraag…"
                    className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none min-w-0"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, { type: e.target.value as 'single' | 'multi' | 'range' })}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 focus:outline-none shrink-0"
                  >
                    <option value="single">Enkelvoudig</option>
                    <option value="multi">Meervoudig</option>
                    <option value="range">Range</option>
                  </select>
                  {flow.startQuestionId === q.id && (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-600 font-medium shrink-0">Start</span>
                  )}
                  <button
                    onClick={() => setCollapsedQuestions(prev => {
                      const next = new Set(prev)
                      next.has(q.id) ? next.delete(q.id) : next.add(q.id)
                      return next
                    })}
                    className="text-gray-400 hover:text-gray-600 transition-colors text-sm leading-none px-1 shrink-0"
                    title={collapsedQuestions.has(q.id) ? 'Uitklappen' : 'Inklappen'}
                  >
                    {collapsedQuestions.has(q.id) ? '▶' : '▼'}
                  </button>
                  <span className="w-px h-4 bg-gray-200" />
                  <button
                    onClick={() => removeQuestion(q.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                    title="Vraag verwijderen"
                  >
                    ×
                  </button>
                </div>

                {/* Vraagopties + toelichting (zichtbaar als niet ingeklapt) */}
                {!collapsedQuestions.has(q.id) && (
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
                    {q.type !== 'range' && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-gray-500 shrink-0">Weergave</label>
                        <select
                          value={q.layout ?? 'text'}
                          onChange={(e) => updateQuestion(q.id, { layout: e.target.value as AnswerLayout })}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none bg-white"
                        >
                          <option value="text">Tekst</option>
                          <option value="image">Afbeeldingen</option>
                          <option value="image-text">Afb. + tekst</option>
                          <option value="size">Maten / chips</option>
                        </select>
                        {(q.layout === 'image' || q.layout === 'image-text') && (
                          <select
                            value={q.imageColumns ?? 2}
                            onChange={e => updateQuestion(q.id, { imageColumns: Number(e.target.value) as 2 | 3 | 4 })}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none bg-white"
                          >
                            <option value={2}>2 kolommen</option>
                            <option value={3}>3 kolommen</option>
                            <option value={4}>4 kolommen</option>
                          </select>
                        )}
                      </div>
                    )}
                    <div>
                      <textarea
                        value={q.intro ?? ''}
                        onChange={(e) => updateQuestion(q.id, { intro: e.target.value })}
                        placeholder="Toelichting (optioneel) — zichtbaar boven de vraag in de widget…"
                        rows={2}
                        className="w-full text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 placeholder-gray-300"
                        onInput={(e) => {
                          const el = e.currentTarget
                          el.style.height = 'auto'
                          el.style.height = el.scrollHeight + 'px'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Range-instellingen */}
                {q.type === 'range' && !collapsedQuestions.has(q.id) && (
                  <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 space-y-3">
                    <p className="text-xs font-semibold text-blue-700">Range-instellingen</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Attribuutveld</label>
                        <input
                          list="product-fields-list"
                          value={q.rangeField ?? ''}
                          onChange={e => updateQuestion(q.id, { rangeField: e.target.value })}
                          placeholder="bijv. breedte_mm"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Eenheid</label>
                        <input
                          value={q.rangeUnit ?? ''}
                          onChange={e => updateQuestion(q.id, { rangeUnit: e.target.value })}
                          placeholder="bijv. mm, kg, cm"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Minimum</label>
                        <input
                          type="number"
                          value={q.rangeMin ?? 0}
                          onChange={e => updateQuestion(q.id, { rangeMin: Number(e.target.value) })}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                        <input
                          type="number"
                          value={q.rangeMax ?? 1000}
                          onChange={e => updateQuestion(q.id, { rangeMax: Number(e.target.value) })}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Stap</label>
                        <input
                          type="number"
                          min={1}
                          value={q.rangeStep ?? 1}
                          onChange={e => updateQuestion(q.id, { rangeStep: Number(e.target.value) })}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-4">
                        <input
                          type="checkbox"
                          id={`strict-${q.id}`}
                          checked={q.rangeStrictFilter ?? false}
                          onChange={e => updateQuestion(q.id, { rangeStrictFilter: e.target.checked })}
                          className="rounded"
                        />
                        <label htmlFor={`strict-${q.id}`} className="text-xs text-gray-600 cursor-pointer">
                          Strikt filteren (alleen ≥ invoer tonen)
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Volgende vraag</label>
                      <select
                        value={q.rangeNextQuestionId ?? ''}
                        onChange={e => updateQuestion(q.id, { rangeNextQuestionId: e.target.value || null })}
                        className={`border rounded-lg px-2 py-1 text-xs focus:outline-none max-w-64 font-medium ${
                          q.rangeNextQuestionId ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-green-200 text-green-700 bg-green-50'
                        }`}
                      >
                        <option value="">✓ Resultaten</option>
                        {flow.questions.filter(oq => oq.id !== q.id).map(oq => (
                          <option key={oq.id} value={oq.id}>{oq.text}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Antwoorden */}
                {q.type !== 'range' && !collapsedQuestions.has(q.id) && <>
                <div className="divide-y divide-gray-50">
                  {q.answers.map((a) => {
                    const answerKey = `${q.id}-${a.id}`
                    const isExpanded = expandedAnswer === answerKey
                    return (
                      <div key={a.id}>
                        <div className="px-5 py-3 flex items-center gap-3">
                          <span className="text-gray-300 text-xs">↳</span>
                          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                            <input
                              value={a.text}
                              onChange={(e) =>
                                updateAnswer(q.id, a.id, { text: e.target.value })
                              }
                              className="text-sm text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full"
                              placeholder="Antwoordtekst…"
                            />
                            <input
                              value={a.label ?? ''}
                              onChange={(e) =>
                                updateAnswer(q.id, a.id, { label: e.target.value })
                              }
                              className="text-xs text-purple-600 bg-transparent border-b border-transparent hover:border-purple-200 focus:border-purple-400 focus:outline-none w-full"
                              placeholder="Commercieel label (optioneel, zichtbaar in resultaten)…"
                            />
                            <input
                              value={a.info ?? ''}
                              onChange={(e) =>
                                updateAnswer(q.id, a.id, { info: e.target.value })
                              }
                              className="text-xs text-amber-600 bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 focus:outline-none w-full"
                              placeholder="ⓘ Toelichting (optioneel, zichtbaar als 'i'-knop in de widget)…"
                            />
                          </div>
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
                          <span className="w-px h-4 bg-gray-200 mx-1" />
                          <button
                            onClick={() => removeAnswer(q.id, a.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                          >
                            ×
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="bg-gray-50 px-5 py-4 border-t border-gray-100 space-y-4">
                            {/* Afbeelding */}
                            <ImageUploadField
                              value={a.imageUrl}
                              onChange={(url) => updateAnswer(q.id, a.id, { imageUrl: url })}
                            />
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-600">
                                  Matchregels (automatisch filteren)
                                </p>
                                <div className="flex items-center gap-2">
                                  {matchCounts[answerKey] !== undefined && (
                                    <span className={`text-xs font-medium ${matchCounts[answerKey] === null ? 'text-gray-400' : matchCounts[answerKey] === 0 ? 'text-red-500' : 'text-green-600'}`}>
                                      {matchCounts[answerKey] === null ? '…' : `${matchCounts[answerKey]} producten`}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => countMatchProducts(answerKey, a.matchRules, a.pinnedProductIds)}
                                    className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Controleer hoeveel producten matchen"
                                  >
                                    ▶ Controleer
                                  </button>
                                  <button
                                    onClick={() => addRule(q.id, a.id)}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    + Regel
                                  </button>
                                </div>
                              </div>
                              {a.matchRules.length === 0 && (
                                <p className="text-xs text-gray-400 italic">
                                  Geen regels — alle producten worden getoond.
                                </p>
                              )}
                              {a.matchRules.map((rule, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="flex items-center gap-2 mb-2 flex-wrap"
                                >
                                  <select
                                    value={FIELD_VALUES.has(rule.field) ? rule.field : '__custom__'}
                                    onChange={(e) =>
                                      updateRule(q.id, a.id, rIdx, {
                                        field: e.target.value === '__custom__' ? '' : e.target.value,
                                      })
                                    }
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                  >
                                    {FIELDS.map((f) => (
                                      <option key={f.value} value={f.value}>
                                        {f.label}
                                      </option>
                                    ))}
                                    <option value="__custom__">
                                      Aangepast veld…
                                    </option>
                                  </select>
                                  {!FIELD_VALUES.has(rule.field) && (
                                    <input
                                      type="text"
                                      list="product-fields-list"
                                      value={rule.field}
                                      onChange={(e) =>
                                        updateRule(q.id, a.id, rIdx, { field: e.target.value })
                                      }
                                      placeholder="veldnaam uit feed…"
                                      className="w-40 border border-blue-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    />
                                  )}
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

                            {/* ── Bijproducten ── */}
                            <div className="pt-3 mt-1 border-t border-orange-100">
                              <div className="flex items-center justify-between mb-1">
                                <div>
                                  <p className="text-xs font-semibold text-orange-700">Bijproducten</p>
                                  <p className="text-xs text-gray-400">Worden getoond naast de hoofdresultaten als aanvulling.</p>
                                </div>
                              </div>

                              {/* Bijproducten matchregels */}
                              <div className="mb-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-xs text-gray-500">Matchregels</p>
                                  <button
                                    onClick={() => addRelatedRule(q.id, a.id)}
                                    className="text-xs text-orange-600 hover:underline"
                                  >
                                    + Regel
                                  </button>
                                </div>
                                {(a.relatedRules ?? []).length === 0 && (
                                  <p className="text-xs text-gray-400 italic">Geen regels.</p>
                                )}
                                {(a.relatedRules ?? []).map((rule, rIdx) => (
                                  <div key={rIdx} className="flex items-center gap-2 mb-2 flex-wrap">
                                    <select
                                      value={FIELD_VALUES.has(rule.field) ? rule.field : '__custom__'}
                                      onChange={(e) => updateRelatedRule(q.id, a.id, rIdx, { field: e.target.value === '__custom__' ? '' : e.target.value })}
                                      className="border border-orange-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                    >
                                      {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                                      <option value="__custom__">Aangepast veld…</option>
                                    </select>
                                    {!FIELD_VALUES.has(rule.field) && (
                                      <input type="text" list="product-fields-list" value={rule.field}
                                        onChange={(e) => updateRelatedRule(q.id, a.id, rIdx, { field: e.target.value })}
                                        placeholder="veldnaam…"
                                        className="w-40 border border-orange-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
                                      />
                                    )}
                                    <select
                                      value={rule.operator}
                                      onChange={(e) => updateRelatedRule(q.id, a.id, rIdx, { operator: e.target.value as MatchRule['operator'] })}
                                      className="border border-orange-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                                    >
                                      {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    <input
                                      value={rule.value}
                                      onChange={(e) => updateRelatedRule(q.id, a.id, rIdx, { value: e.target.value })}
                                      placeholder="waarde…"
                                      className="flex-1 border border-orange-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
                                    />
                                    <button onClick={() => removeRelatedRule(q.id, a.id, rIdx)} className="text-gray-300 hover:text-red-400 text-base">×</button>
                                  </div>
                                ))}
                              </div>

                              {/* Bijproducten pinnen */}
                              <div>
                                <p className="text-xs text-gray-500 mb-1.5">Vastgepind ({(a.relatedPinnedIds ?? []).length})</p>
                                <input
                                  type="text"
                                  value={productSearch[`rel_${answerKey}`] ?? ''}
                                  onChange={(e) => searchProducts(`rel_${answerKey}`, e.target.value)}
                                  placeholder="Zoek bijproduct…"
                                  className="w-full border border-orange-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white mb-2"
                                />
                                {(productResults[`rel_${answerKey}`] ?? []).map((p) => (
                                  <div key={p._id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                                    {p.imageLink && <img src={p.imageLink} alt="" className="w-8 h-8 object-contain rounded border border-gray-100" />}
                                    <span className="flex-1 text-xs text-gray-700 line-clamp-1">{p.title}</span>
                                    <button
                                      onClick={() => toggleRelatedPin(q.id, a.id, p._id, a.relatedPinnedIds ?? [])}
                                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                        (a.relatedPinnedIds ?? []).includes(p._id)
                                          ? 'bg-orange-100 text-orange-700 hover:bg-red-50 hover:text-red-500'
                                          : 'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-orange-600'
                                      }`}
                                    >
                                      {(a.relatedPinnedIds ?? []).includes(p._id) ? '✓ Gepind' : '+ Pinnen'}
                                    </button>
                                  </div>
                                ))}
                                {(a.relatedPinnedIds ?? []).length > 0 && (
                                  <p className="text-xs text-gray-400 mt-1">{(a.relatedPinnedIds ?? []).length} bijproduct(en) vastgepind.</p>
                                )}
                              </div>
                            </div>

                            {/* ── Maatwerk formulier ── */}
                            <div className="pt-3 mt-1 border-t border-teal-100">
                              <label className="flex items-center justify-between cursor-pointer">
                                <div>
                                  <p className="text-xs font-semibold text-teal-700">Maatwerkformulier tonen</p>
                                  <p className="text-xs text-gray-400">Toon het aanvraagformulier i.p.v. productresultaten.</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={a.maatwerkMode ?? false}
                                  onChange={e => updateAnswer(q.id, a.id, { maatwerkMode: e.target.checked })}
                                  className="rounded"
                                />
                              </label>
                              {a.maatwerkMode && (
                                <p className="text-xs text-teal-600 mt-2">
                                  Formulierinhoud (titel, tekst, velden) configureren via{' '}
                                  <button type="button" onClick={() => setActiveTab('instellingen')} className="underline hover:text-teal-800">Instellingen → Maatwerkformulier</button>.
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
                </>}
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
      {activeTab === 'preview' && (() => {
        const ws = flow.widgetStyle ?? {}
        const params = new URLSearchParams()
        if (ws.primaryColor)  params.set('color',  ws.primaryColor)
        if (ws.borderRadius)  params.set('radius', ws.borderRadius)
        if (ws.fontFamily)    params.set('font',   ws.fontFamily)
        const previewSrc = `/widget/${id}?${params}`
        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                Live preview — stijlwijzigingen worden direct doorgegeven.
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
                key={`${previewKey}_${ws.primaryColor}_${ws.borderRadius}_${ws.fontFamily}`}
                src={previewSrc}
                className="w-full"
                style={{ height: '600px', border: 'none' }}
                title="Keuzehulp voorbeeld"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Embed-URL: <code className="bg-gray-100 px-1 rounded">/widget/{id}</code>
            </p>
          </div>
        )
      })()}

      {/* ── Tab: Instellingen ── */}
      {activeTab === 'instellingen' && (
        <div className="space-y-5">

          {/* ── Weergave ─────────────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 pt-1">Weergave</p>

          {/* Widget stijl */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Stijl</h3>
            <p className="text-xs text-gray-400 mb-4">Kleur, afgerondheid en lettertype van de widget.</p>
            {(() => {
              const ws: WidgetStyle = { ...DEFAULT_WIDGET_STYLE, ...(flow.widgetStyle ?? {}) }
              const updateStyle = (patch: Partial<WidgetStyle>) =>
                update(f => ({ ...f, widgetStyle: { ...ws, ...patch } }))
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <span>Primaire kleur</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={ws.primaryColor}
                        onChange={e => updateStyle({ primaryColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                      />
                      <input
                        type="text"
                        value={ws.primaryColor}
                        onChange={e => updateStyle({ primaryColor: e.target.value })}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <span>Afgerondheid</span>
                    <div className="flex gap-1">
                      {(['none', 'small', 'medium', 'large'] as BorderRadius[]).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => updateStyle({ borderRadius: r })}
                          className={`px-3 py-1 text-xs font-medium border transition-colors ${
                            ws.borderRadius === r
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                          style={{ borderRadius: { none: '0', small: '6px', medium: '8px', large: '16px' }[r] }}
                        >
                          {{ none: 'Geen', small: 'Klein', medium: 'Normaal', large: 'Groot' }[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <span>Lettertype</span>
                    <input
                      type="text"
                      value={ws.fontFamily}
                      onChange={e => updateStyle({ fontFamily: e.target.value })}
                      placeholder="Overerven van webshop"
                      className="w-56 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {['system-ui, sans-serif', 'Inter, sans-serif', 'Roboto, sans-serif', 'Open Sans, sans-serif', 'Georgia, serif'].map(f => (
                      <button key={f} type="button"
                        onClick={() => updateStyle({ fontFamily: f })}
                        className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:border-blue-300 text-gray-500 transition-colors"
                        style={{ fontFamily: f }}
                      >
                        {f.split(',')[0]}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">Voorbeeld</p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: ws.primaryColor, borderRadius: { none: '0', small: '6px', medium: '12px', large: '20px' }[ws.borderRadius], fontFamily: ws.fontFamily || undefined }}
                      >
                        Volgende →
                      </button>
                      <div
                        className="px-4 py-2 text-sm font-medium border-2"
                        style={{ borderColor: ws.primaryColor, color: ws.primaryColor, borderRadius: { none: '0', small: '6px', medium: '12px', large: '20px' }[ws.borderRadius], fontFamily: ws.fontFamily || undefined }}
                      >
                        Antwoordknop actief
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </section>

          {/* Gedrag */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Gedrag</h3>
            {(() => {
              const wb: WidgetBehavior = { ...DEFAULT_BEHAVIOR, ...(flow.widgetBehavior ?? {}) }
              const updateBehavior = (patch: Partial<WidgetBehavior>) =>
                update(f => ({ ...f, widgetBehavior: { ...wb, ...patch } }))
              const Toggle = ({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) => (
                <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm text-gray-700">{label}</p>
                    {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
                  </div>
                  <button type="button" onClick={() => onChange(!value)}
                    className={`shrink-0 w-10 h-6 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${value ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              )
              return (
                <div>
                  <Toggle label="Animaties" desc="Vragen schuiven in en uit"
                    value={wb.enableAnimations} onChange={v => updateBehavior({ enableAnimations: v })} />
                  <Toggle label="Antwoorden onthouden"
                    desc="Sla antwoorden op in de browser zodat terugkerende bezoekers verder gaan"
                    value={wb.rememberAnswers} onChange={v => updateBehavior({ rememberAnswers: v })} />
                  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50">
                    <div>
                      <p className="text-sm text-gray-700">Voortgangsindicator</p>
                    </div>
                    <div className="flex gap-1">
                      {(['bar', 'steps'] as const).map(s => (
                        <button key={s} type="button" onClick={() => updateBehavior({ progressStyle: s })}
                          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                            wb.progressStyle === s ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'
                          }`}>
                          {s === 'bar' ? 'Balk' : 'Vraag X van Y'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Toggle label="Trusted Shops productreviews"
                    desc="Sterren + aantal reviews per product (vereist TRUSTED_SHOPS_ID in .env.local)"
                    value={wb.showProductReviews} onChange={v => updateBehavior({ showProductReviews: v })} />
                  <Toggle label="Trusted Shops shopbeoordeling"
                    desc="Toon de overall shopbeoordeling onder de resultaten"
                    value={wb.showShopRating} onChange={v => updateBehavior({ showShopRating: v })} />
                </div>
              )
            })()}
          </section>

          {/* ── Resultaten ───────────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 pt-2">Resultaten</p>

          {/* Titel resultaten */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Paginatitel</h3>
            <p className="text-xs text-gray-400 mb-3">De kop boven de productresultaten. Standaard "Jouw resultaten".</p>
            <input
              value={flow.resultsTitle ?? ''}
              onChange={e => update(f => ({ ...f, resultsTitle: e.target.value }))}
              placeholder="Jouw resultaten"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </section>

          {/* Dynamische resultaattekst */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Dynamische introtekst</h3>
            <p className="text-xs text-gray-400 mb-3">
              Toon een samenvatting boven de resultaten op basis van de antwoorden. Gebruik <code className="bg-gray-100 px-1 rounded">{'{vraagId}'}</code> als variabele.
            </p>
            <textarea
              value={flow.resultsSummaryTemplate ?? ''}
              onChange={e => update(f => ({ ...f, resultsSummaryTemplate: e.target.value }))}
              placeholder={'Bijv. "Je bent op zoek naar een {abc123} voor {def456}."'}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
            />
            {flow.questions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {flow.questions.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => update(f => ({ ...f, resultsSummaryTemplate: (f.resultsSummaryTemplate ?? '') + `{${q.id}}` }))}
                    className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded transition-colors"
                    title={q.text}
                  >
                    {'{' + q.id + '}'} <span className="text-gray-400">({i + 1}. {q.text.slice(0, 20)}{q.text.length > 20 ? '…' : ''})</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Extra productinformatie */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Extra productinformatie</h3>
            <p className="text-xs text-gray-400 mb-3">
              Selecteer welke feedattributen worden getoond op de productkaart. Typ de exacte veldnaam (zie <a href="/attributen" className="text-blue-600 hover:underline">Attributen</a>).
            </p>
            <div className="space-y-2">
              {(flow.displayAttributes ?? []).map((attr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={attr}
                    list="product-fields-list"
                    onChange={e => {
                      const next = [...(flow.displayAttributes ?? [])]
                      next[i] = e.target.value
                      update(f => ({ ...f, displayAttributes: next }))
                    }}
                    placeholder="veldnaam…"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => update(f => ({ ...f, displayAttributes: (f.displayAttributes ?? []).filter((_, j) => j !== i) }))}
                    className="text-gray-300 hover:text-red-400 text-lg"
                  >×</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update(f => ({ ...f, displayAttributes: [...(f.displayAttributes ?? []), ''] }))}
                className="text-xs text-blue-600 hover:underline"
              >
                + Veld toevoegen
              </button>
            </div>
          </section>

          {/* ── Maatwerkformulier ────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 pt-2">Maatwerkformulier</p>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Maatwerkformulier</h3>
            <p className="text-xs text-gray-400 mb-4">
              Configureer het formulier dat getoond wordt wanneer een antwoord is ingesteld op "Maatwerkformulier tonen".
              Er is één formulier per keuzehulp; meerdere antwoorden kunnen er naartoe verwijzen.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Formuliertitel</label>
                <input
                  value={flow.maatwerkTitle ?? ''}
                  onChange={e => update(f => ({ ...f, maatwerkTitle: e.target.value }))}
                  placeholder="Bijv. Offerte aanvragen"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Inleidende tekst</label>
                <textarea
                  value={flow.maatwerkIntro ?? ''}
                  onChange={e => update(f => ({ ...f, maatwerkIntro: e.target.value }))}
                  placeholder="Bijv. Op basis van uw keuzes stellen wij een offerte op maat voor u samen."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E-mail ontvanger aanvragen</label>
                <input
                  type="email"
                  value={flow.maatwerkEmailTo ?? ''}
                  onChange={e => update(f => ({ ...f, maatwerkEmailTo: e.target.value }))}
                  placeholder="aanvragen@bedrijf.nl"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Formuliervelden</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newField: MaatwerkField = { id: uid(), label: '', type: 'text', required: false, placeholder: '' }
                      update(f => ({ ...f, maatwerkFields: [...(f.maatwerkFields ?? []), newField] }))
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    + Veld toevoegen
                  </button>
                </div>
                {(flow.maatwerkFields ?? []).length === 0 && (
                  <p className="text-xs text-gray-400 italic">Nog geen velden. Voeg inhoudelijke vragen toe voor de aanvrager.</p>
                )}
                {(flow.maatwerkFields ?? []).map((f, fIdx) => (
                  <div key={f.id} className="flex items-center gap-2 mb-2 flex-wrap">
                    <input
                      value={f.label}
                      onChange={e => {
                        const next = [...(flow.maatwerkFields ?? [])]
                        next[fIdx] = { ...next[fIdx], label: e.target.value }
                        update(fl => ({ ...fl, maatwerkFields: next }))
                      }}
                      placeholder="Veldlabel…"
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <select
                      value={f.type}
                      onChange={e => {
                        const next = [...(flow.maatwerkFields ?? [])]
                        next[fIdx] = { ...next[fIdx], type: e.target.value as MaatwerkField['type'] }
                        update(fl => ({ ...fl, maatwerkFields: next }))
                      }}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                    >
                      <option value="text">Tekst</option>
                      <option value="textarea">Tekstvak</option>
                      <option value="number">Getal</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefoon</option>
                      <option value="file">Bestand</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={e => {
                          const next = [...(flow.maatwerkFields ?? [])]
                          next[fIdx] = { ...next[fIdx], required: e.target.checked }
                          update(fl => ({ ...fl, maatwerkFields: next }))
                        }}
                      />
                      Verplicht
                    </label>
                    <button
                      onClick={() => update(fl => ({ ...fl, maatwerkFields: (fl.maatwerkFields ?? []).filter((_, i) => i !== fIdx) }))}
                      className="text-gray-300 hover:text-red-400 text-lg"
                    >×</button>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flow.maatwerkIncludeAddress ?? false}
                  onChange={e => update(f => ({ ...f, maatwerkIncludeAddress: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Fysiek adres opvragen (straat, postcode, plaats)</span>
              </label>
            </div>
          </section>

          {/* ── Rangschikking ────────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 pt-2">Rangschikking</p>

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

          {/* ── Integraties ──────────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 pt-2">Integraties</p>

          {/* Mail mij de resultaten */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-800">Resultaten e-mailen</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flow.emailResults ?? false}
                  onChange={e => update(f => ({ ...f, emailResults: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Ingeschakeld</span>
              </label>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Toont een e-mailformulier onder de resultaten. Vereist SMTP-configuratie in <code className="bg-gray-100 px-1 rounded">.env.local</code>.
            </p>
            {(flow.emailResults ?? false) && (
              <label className="flex items-center justify-between text-sm text-gray-700">
                <span>Onderwerpregel</span>
                <input
                  type="text"
                  value={flow.emailSubject ?? ''}
                  onChange={e => update(f => ({ ...f, emailSubject: e.target.value }))}
                  placeholder={`Jouw aanbevolen producten — ${flow.name}`}
                  className="w-72 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </label>
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

          {/* Spotler Activate */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Spotler Activate</h3>
            <p className="text-xs text-gray-400 mb-4">
              Koppel elke vraag aan een Spotler Activate-attribuut. De widget stuurt de antwoorden direct
              naar <code className="bg-gray-100 px-1 rounded">_spq</code> zonder Tag Manager.
              Attribuutnamen vind je in <em>Spotler Activate → Data → Attributen</em>.
            </p>
            <div className="space-y-2">
              {flow.questions.length === 0 && (
                <p className="text-xs text-gray-400 italic">Voeg eerst vragen toe in de Editor.</p>
              )}
              {flow.questions.map((q, i) => {
                const sa = flow.spotlerAttributes ?? {}
                return (
                  <div key={q.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-6 shrink-0 text-right">{i + 1}.</span>
                    <span className="flex-1 text-xs text-gray-700 truncate">{q.text}</span>
                    <span className="text-gray-300 text-xs">→</span>
                    <input
                      type="text"
                      value={sa[q.id] ?? ''}
                      onChange={e => update(f => ({
                        ...f,
                        spotlerAttributes: { ...(f.spotlerAttributes ?? {}), [q.id]: e.target.value }
                      }))}
                      placeholder="attribuutnaam"
                      className="w-40 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                )
              })}
            </div>
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
        <EmbedTab flowId={id} flowName={flow.name} primaryColor={flow.widgetStyle?.primaryColor ?? '#2563eb'} />
      )}
    </div>
  )
}
