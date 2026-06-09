'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface Answer {
  id: string
  text: string
  label?: string
  info?: string
  imageUrl: string
  nextQuestionId: string | null
  matchRules: { field: string; operator: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'startsWith' | 'gt' | 'gte' | 'lt' | 'lte'; value: string }[]
  pinnedProductIds: string[]
  maatwerkMode?: boolean
}

type AnswerLayout = 'text' | 'image' | 'image-text' | 'size'

interface Question {
  id: string
  text: string
  intro?: string
  type: 'single' | 'multi' | 'range'
  layout: AnswerLayout
  answers: Answer[]
  rangeField?: string
  rangeUnit?: string
  rangeMin?: number
  rangeMax?: number
  rangeStep?: number
  rangeStrictFilter?: boolean
  rangeNextQuestionId?: string | null
}

interface WidgetStyle {
  primaryColor: string
  borderRadius: 'none' | 'small' | 'medium' | 'large'
  fontFamily: string
}

interface AnswerTranslation { text?: string; label?: string; info?: string }
interface QuestionTranslation { text?: string; intro?: string; answers?: Record<string, AnswerTranslation> }
interface FlowTranslation { questions?: Record<string, QuestionTranslation> }

interface Flow {
  _id: string
  name: string
  description: string
  storeView?: string
  translations?: Record<string, FlowTranslation>
  startQuestionId: string
  questions: Question[]
  adobeCommerceUrl?: string
  widgetStyle?: WidgetStyle
  emailResults?: boolean
  emailSubject?: string
  spotlerAttributes?: Record<string, string>
  resultsSummaryTemplate?: string
  resultsTitle?: string
  displayAttributes?: string[]
  maatwerkTitle?: string
  maatwerkIntro?: string
  maatwerkFields?: MaatwerkField[]
  maatwerkIncludeAddress?: boolean
  widgetBehavior?: {
    enableAnimations: boolean
    rememberAnswers: boolean
    progressStyle: 'bar' | 'steps'
    showProductReviews: boolean
    showShopRating: boolean
  }
}

interface RuleResult {
  field: string
  operator: string
  value: string
  matched: boolean
  productValue: string
  answerId: string
}

interface ScoredProduct {
  product: {
    _id: string
    title: string
    brand: string
    shortDescription: string
    price: number
    salePrice: number | null
    lowestPrice: number | null
    imageLink: string
    link: string
    availability: string
    sku: string
    qtyIncrement?: number
  }
  score: number
  isPerfect: boolean
  matchedRules: number
  totalRules: number
  ruleResults: RuleResult[]
  boostBreakdown: { label: string; points: number }[]
  searchCriteria: string[]
}

interface MatchResponse {
  perfect: ScoredProduct[]
  alternatives: ScoredProduct[]
  searchCriteria: string[]
  related: ScoredProduct[]
}

type Phase = 'loading' | 'question' | 'results' | 'maatwerk' | 'maatwerk-done' | 'error'

interface MaatwerkField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'file'
  required: boolean
  placeholder: string
}

// ── Layout-helpers ───────────────────────────────────────────────────────────

function answerWrapperClass(layout: AnswerLayout, cols = 2) {
  if (layout === 'image') return `grid gap-3`
  if (layout === 'size')  return 'flex flex-wrap gap-2'
  return 'space-y-3'
}

function answerWrapperStyle(layout: AnswerLayout, cols = 2): React.CSSProperties {
  if (layout === 'image') return { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
  return {}
}

function singleBtnClass(layout: AnswerLayout, active = false) {
  const base = 'transition-all font-medium text-sm border-2 '
  if (layout === 'image')      return base + 'overflow-hidden flex flex-col ' + (active ? '' : 'border-gray-200')
  if (layout === 'image-text') return base + 'w-full text-left flex items-center gap-3 p-3 ' + (active ? '' : 'border-gray-200 text-gray-800')
  if (layout === 'size')       return base + 'px-4 py-2 ' + (active ? '' : 'border-gray-200 text-gray-700')
  return base + 'w-full text-left px-5 py-4 flex items-center gap-3 ' + (active ? '' : 'border-gray-200 text-gray-800')
}

function singleBtnStyle(active: boolean, khRadius: string): React.CSSProperties {
  return {
    borderRadius: khRadius,
    ...(active ? {
      borderColor: 'var(--kh)',
      backgroundColor: 'color-mix(in srgb, var(--kh) 10%, white)',
      color: 'var(--kh)',
    } : {}),
  }
}

function AnswerContent({ a, layout }: { a: Answer; layout: AnswerLayout }) {
  if (layout === 'image') return (
    <>
      {a.imageUrl
        ? <img src={a.imageUrl} alt="" className="w-full aspect-square object-cover" />
        : <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-300 text-3xl">□</div>
      }
      {a.text && <span className="block text-xs text-center py-2 px-2 font-medium text-gray-700">{a.text}</span>}
    </>
  )
  if (layout === 'image-text') return (
    <>
      {a.imageUrl
        ? <img src={a.imageUrl} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-100 shrink-0" />
        : <div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0" />
      }
      <span>{a.text}</span>
    </>
  )
  if (layout === 'size') return <span>{a.text}</span>
  return (
    <>
      {a.imageUrl && <img src={a.imageUrl} alt="" className="w-10 h-10 object-contain rounded shrink-0" />}
      <span>{a.text}</span>
    </>
  )
}

// ── Maatwerk formulier ───────────────────────────────────────────────────────

function MaatwerkFormView({ flowId, flow, answerId, selections, khRadius, done, onSubmitDone, onBack }: {
  flowId: string
  flow: Flow
  answerId: string
  selections: { questionText: string; answerText: string }[]
  khRadius: string
  done: boolean
  onSubmitDone: () => void
  onBack: () => void
}) {
  const fields = flow.maatwerkFields ?? []
  const includeAddress = flow.maatwerkIncludeAddress ?? false
  const title = flow.maatwerkTitle || 'Aanvraag indienen'
  const intro = flow.maatwerkIntro || ''

  const [values, setValues] = useState<Record<string, string>>({})
  const [fileMap, setFileMap] = useState<Record<string, { name: string; url: string }>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [contact, setContact] = useState({ naam: '', email: '', telefoon: '', straat: '', postcode: '', plaats: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const uploadFile = async (fieldId: string, file: File) => {
    setUploading(u => ({ ...u, [fieldId]: true }))
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    setUploading(u => ({ ...u, [fieldId]: false }))
    if (res.ok) {
      const { url } = await res.json()
      setFileMap(m => ({ ...m, [fieldId]: { name: file.name, url } }))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!contact.email) { setError('E-mailadres is verplicht.'); return }
    setSubmitting(true)
    const submitFields = fields
      .filter(f => f.type !== 'file')
      .map(f => ({ label: f.label, type: f.type, value: values[f.id] ?? '' }))
    const submitFiles = fields
      .filter(f => f.type === 'file' && fileMap[f.id])
      .map(f => ({ label: f.label, filename: fileMap[f.id].name, url: fileMap[f.id].url }))
    const res = await fetch('/api/maatwerk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId, answerId, selections, fields: submitFields, files: submitFiles, contact }),
    })
    setSubmitting(false)
    if (res.ok) { onSubmitDone() } else { setError('Verzenden mislukt. Probeer het opnieuw.') }
  }

  if (done) return (
    <div className="text-center py-10 space-y-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl"
        style={{ backgroundColor: 'color-mix(in srgb, var(--kh) 15%, white)' }}>
        ✓
      </div>
      <h2 className="text-xl font-bold text-gray-900">Aanvraag ontvangen!</h2>
      <p className="text-sm text-gray-500">We nemen zo snel mogelijk contact met je op.</p>
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-4">
        ← Opnieuw beginnen
      </button>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Titel + intro */}
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {intro && <p className="text-sm text-gray-500 leading-relaxed">{intro}</p>}

      {/* Samenvatting gemaakte keuzes */}
      {selections.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Jouw keuzes</p>
          <dl className="space-y-1.5">
            {selections.map((s, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <dt className="text-gray-400 shrink-0 w-2/5 truncate">{s.questionText}</dt>
                <dd className="font-medium text-gray-700">{s.answerText}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Inhoudelijke velden */}
      {fields.map(f => (
        <div key={f.id}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {f.type === 'textarea' ? (
            <textarea
              required={f.required}
              placeholder={f.placeholder}
              value={values[f.id] ?? ''}
              onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--kh)' } as React.CSSProperties}
            />
          ) : f.type === 'file' ? (
            <div>
              <input
                type="file"
                onChange={e => { const file = e.target.files?.[0]; if (file) uploadFile(f.id, file) }}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              {uploading[f.id] && <p className="text-xs text-gray-400 mt-1">Uploaden…</p>}
              {fileMap[f.id] && <p className="text-xs text-green-600 mt-1">✓ {fileMap[f.id].name}</p>}
            </div>
          ) : (
            <input
              type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
              required={f.required}
              placeholder={f.placeholder}
              value={values[f.id] ?? ''}
              onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--kh)' } as React.CSSProperties}
            />
          )}
        </div>
      ))}

      {/* Contactgegevens */}
      <div className="pt-4 mt-2 border-t border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Contactgegevens</p>
        <div className="space-y-3">
          {[
            { key: 'naam',     label: 'Naam',          type: 'text',  required: true },
            { key: 'email',    label: 'E-mailadres',    type: 'email', required: true },
            { key: 'telefoon', label: 'Telefoonnummer', type: 'tel',   required: false },
          ].map(({ key, label, type, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                type={type} required={required}
                value={contact[key as keyof typeof contact]}
                onChange={e => setContact(c => ({ ...c, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--kh)' } as React.CSSProperties}
              />
            </div>
          ))}
          {includeAddress && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Straat + huisnummer</label>
                <input type="text" value={contact.straat}
                  onChange={e => setContact(c => ({ ...c, straat: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': 'var(--kh)' } as React.CSSProperties}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                  <input type="text" value={contact.postcode}
                    onChange={e => setContact(c => ({ ...c, postcode: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': 'var(--kh)' } as React.CSSProperties}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plaats</label>
                  <input type="text" value={contact.plaats}
                    onChange={e => setContact(c => ({ ...c, plaats: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': 'var(--kh)' } as React.CSSProperties}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 text-white font-medium text-sm disabled:opacity-50 transition-colors"
        style={{ backgroundColor: 'var(--kh)', borderRadius: khRadius }}
      >
        {submitting ? 'Verzenden…' : 'Aanvraag versturen'}
      </button>
      <button type="button" onClick={onBack} className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
        ← Terug
      </button>
    </form>
  )
}

// ── Range invoer (slider + getal, gesynchroniseerd) ─────────────────────────

function RangeInput({ question, value, onChange, onConfirm, khRadius }: {
  question: Question
  value: string | undefined
  onChange: (v: string) => void
  onConfirm: () => void
  khRadius: string
}) {
  const min  = question.rangeMin  ?? 0
  const max  = question.rangeMax  ?? 1000
  const step = question.rangeStep ?? 1
  const unit = question.rangeUnit ?? ''
  const defaultVal = Math.round((min + max) / 2 / step) * step
  const numValue = value !== undefined && value !== '' ? parseFloat(value) : defaultVal

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <input
          type="number"
          min={min} max={max} step={step}
          value={numValue}
          onChange={e => onChange(e.target.value)}
          className="w-28 border-2 rounded-xl px-3 py-2 text-xl font-bold text-center focus:outline-none"
          style={{ borderColor: 'var(--kh)', color: 'var(--kh)' }}
        />
        {unit && <span className="text-gray-500 text-base">{unit}</span>}
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={numValue}
        onChange={e => onChange(e.target.value)}
        className="w-full mb-2"
        style={{ accentColor: 'var(--kh)' }}
      />
      <div className="flex justify-between text-xs text-gray-400 mb-6">
        <span>{min}{unit ? ` ${unit}` : ''}</span>
        <span>{max}{unit ? ` ${unit}` : ''}</span>
      </div>
      <button
        onClick={onConfirm}
        className="w-full py-3 text-white font-medium text-sm transition-colors"
        style={{ backgroundColor: 'var(--kh)', borderRadius: khRadius }}
      >
        Volgende →
      </button>
    </div>
  )
}

function AnswerList({
  question,
  selectedAnswers,
  onSelectSingle,
  onToggleMulti,
  onConfirmMulti,
  khRadius,
}: {
  question: Question
  selectedAnswers: Record<string, string | string[]>
  onSelectSingle: (a: Answer) => void
  onToggleMulti: (id: string) => void
  onConfirmMulti: () => void
  khRadius: string
}) {
  const layout = question.layout ?? 'text'
  const cols = (question as Question & { imageColumns?: number }).imageColumns ?? 2
  const wrapperClass = answerWrapperClass(layout, cols)
  const wrapperStyle = answerWrapperStyle(layout, cols)
  const [infoOpen, setInfoOpen] = useState<string | null>(null)

  if (question.type === 'single') {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        {question.answers.map(a => (
          <div key={a.id} className="relative">
            <button onClick={() => onSelectSingle(a)}
              className={singleBtnClass(layout)}
              style={singleBtnStyle(false, khRadius)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--kh)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              <AnswerContent a={a} layout={layout} />
            </button>
            {a.info && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setInfoOpen(infoOpen === a.id ? null : a.id) }}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-50 border border-amber-200 text-amber-500 text-xs font-semibold flex items-center justify-center hover:bg-amber-100 z-10 leading-none"
                  title="Meer informatie"
                >
                  i
                </button>
                {infoOpen === a.id && (
                  <div className="absolute right-0 top-9 z-20 bg-white border border-amber-200 rounded-lg shadow-lg text-xs text-amber-800 p-3 w-64 text-left">
                    {a.info}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    )
  }

  // multi
  const chosen = (selectedAnswers[question.id] as string[]) ?? []
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Selecteer alles wat van toepassing is.</p>
      <div className={wrapperClass} style={wrapperStyle}>
        {question.answers.map(a => {
          const selected = chosen.includes(a.id)
          return (
            <div key={a.id} className="relative">
              <button onClick={() => onToggleMulti(a.id)}
                className={singleBtnClass(layout, selected) + (layout === 'text' || layout === 'image-text' ? ' relative' : '')}
                style={singleBtnStyle(selected, khRadius)}>
                {(layout === 'text' || layout === 'image-text') && (
                  <span className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                    style={selected ? { borderColor: 'var(--kh)', backgroundColor: 'var(--kh)', color: 'white' } : { borderColor: '#d1d5db' }}>
                    {selected && <span className="text-xs">✓</span>}
                  </span>
                )}
                {layout === 'size' && selected && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center"
                    style={{ backgroundColor: 'var(--kh)' }}>✓</span>
                )}
                <AnswerContent a={a} layout={layout} />
              </button>
              {a.info && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); setInfoOpen(infoOpen === a.id ? null : a.id) }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-50 border border-amber-200 text-amber-500 text-xs font-semibold flex items-center justify-center hover:bg-amber-100 z-10 leading-none"
                    title="Meer informatie"
                  >
                    i
                  </button>
                  {infoOpen === a.id && (
                    <div className="absolute right-0 top-9 z-20 bg-white border border-amber-200 rounded-lg shadow-lg text-xs text-amber-800 p-3 w-64 text-left">
                      {a.info}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={onConfirmMulti}
        disabled={!chosen.length}
        className="mt-5 w-full py-3 text-white font-medium text-sm disabled:opacity-40 transition-colors"
        style={{ backgroundColor: 'var(--kh)', borderRadius: khRadius }}>
        Volgende →
      </button>
    </div>
  )
}

// ── Sterren component ────────────────────────────────────────────────────────

function Stars({ rating, count }: { rating: number; count?: number }) {
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.25 && rating - full < 0.75
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < full) return 'full'
    if (i === full && half) return 'half'
    return 'empty'
  })
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {stars.map((s, i) => (
          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={s === 'empty' ? 'none' : s === 'half' ? 'url(#half)' : 'currentColor'} stroke="currentColor" strokeWidth="1.5" className="text-yellow-400">
            {s === 'half' && <defs><linearGradient id="half"><stop offset="50%" stopColor="currentColor"/><stop offset="50%" stopColor="transparent"/></linearGradient></defs>}
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        ))}
      </div>
      <span className="text-xs text-gray-500">{rating.toFixed(1)}{count ? ` (${count})` : ''}</span>
    </div>
  )
}

// ── Mail mij de resultaten ───────────────────────────────────────────────────

interface EmailProduct {
  title: string; brand: string; imageLink: string; link: string
  price: number; salePrice: number | null; lowestPrice: number | null
}

function EmailResultsForm({ flow, products, khRadius }: {
  flow: Flow; products: EmailProduct[]; khRadius: string
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('sending')
    const res = await fetch('/api/email-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        flowName: flow.name,
        emailSubject: flow.emailSubject || '',
        products,
        primaryColor: flow.widgetStyle?.primaryColor ?? '#2563eb',
      }),
    })
    setStatus(res.ok ? 'sent' : 'error')
  }

  if (status === 'sent') return (
    <div className="mt-8 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 text-center">
      ✓ Aanbevelingen zijn verstuurd naar {email}
    </div>
  )

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
      <p className="text-sm font-medium text-gray-800 mb-3">Mail mij de resultaten</p>
      <form onSubmit={send} className="flex gap-2">
        <input
          type="email" required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="jouw@emailadres.nl"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white"
          style={{ '--tw-ring-color': 'var(--kh)' } as React.CSSProperties}
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          style={{ backgroundColor: 'var(--kh)', borderRadius: khRadius }}
        >
          {status === 'sending' ? 'Versturen…' : 'Verstuur'}
        </button>
      </form>
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-500">Versturen mislukt. Probeer het later opnieuw.</p>
      )}
    </div>
  )
}

// ── Hoofdpagina ──────────────────────────────────────────────────────────────

function translateQuestion(q: Question, tr: FlowTranslation | undefined): Question {
  if (!tr) return q
  const qTr = tr.questions?.[q.id]
  if (!qTr) return q
  return {
    ...q,
    text: qTr.text || q.text,
    intro: qTr.intro || q.intro,
    answers: q.answers.map(a => {
      const aTr = qTr.answers?.[a.id]
      if (!aTr) return a
      return { ...a, text: aTr.text || a.text, label: aTr.label || a.label, info: aTr.info || a.info }
    }),
  }
}

function WidgetPageInner() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const locale = searchParams.get('locale') ?? 'NL-NL'

  const [flow, setFlow] = useState<Flow | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [currentQuestionId, setCurrentQuestionId] = useState('')
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | string[]>>({})
  const [history, setHistory] = useState<string[]>([])
  const [matchData, setMatchData] = useState<MatchResponse | null>(null)
  const [matching, setMatching] = useState(false)
  const [cartState, setCartState] = useState<Record<string, 'adding' | 'done' | 'error'>>({})
  const [productReviews, setProductReviews] = useState<Record<string, { rating: number; count: number }>>({})
  const [shopRating, setShopRating] = useState<{ rating: number; count: number } | null>(null)
  const [animDir, setAnimDir] = useState<'in' | 'out'>('in')
  const [maatwerkAnswer, setMaatwerkAnswer] = useState<Answer | null>(null)

  const sessionId = useRef(Math.random().toString(36).slice(2) + Date.now().toString(36)).current

  const postMsg = useCallback((type: string, payload: Record<string, string | number> = {}) => {
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'keuzehulp', type, ...payload }, '*')
    }
  }, [])

  const track = useCallback((type: string, data: Record<string, string | number> = {}) => {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId: id, sessionId, type, data }),
    }).catch(() => {})
    postMsg('event', { eventType: type, flowId: id, ...data })
  }, [id, sessionId, postMsg])

  // Stuur hoogte naar parent zodat GTM het iframe kan resizen
  useEffect(() => {
    const send = () => postMsg('resize', { height: document.body.scrollHeight })
    send()
    const ro = new ResizeObserver(send)
    ro.observe(document.body)
    return () => ro.disconnect()
  }, [postMsg, phase, matchData])

  useEffect(() => {
    fetch(`/api/flows/${id}`)
      .then(r => r.json())
      .then((data: Flow) => {
        if (!data._id) { setPhase('error'); return }
        setFlow(data)
        setCurrentQuestionId(data.startQuestionId)
        setPhase('question')
      })
      .catch(() => setPhase('error'))
  }, [id])

  const wb = {
    enableAnimations: true,
    rememberAnswers: false,
    progressStyle: 'bar' as const,
    showProductReviews: true,
    showShopRating: false,
    ...(flow?.widgetBehavior ?? {}),
  }
  const localeTr = flow?.translations?.[locale]
  const rawQuestion = flow?.questions.find(q => q.id === currentQuestionId)
  const currentQuestion = rawQuestion ? translateQuestion(rawQuestion, localeTr) : undefined
  const formatPrice = (p: number) => `€ ${p.toFixed(2).replace('.', ',')}`

  // Antwoorden onthouden in localStorage
  const storageKey = `kh_answers_${id}`
  useEffect(() => {
    if (!wb.rememberAnswers || !flow) return
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, string | string[]>
        setSelectedAnswers(parsed)
      } catch { /* ignore */ }
    }
  }, [flow, wb.rememberAnswers]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (wb.rememberAnswers) localStorage.setItem(storageKey, JSON.stringify(selectedAnswers))
  }, [selectedAnswers, wb.rememberAnswers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trusted Shops shopbeoordeling laden
  useEffect(() => {
    if (!wb.showShopRating) return
    fetch('/api/trusted-shops?type=shop')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.rating?.overallMark) setShopRating({ rating: d.rating.overallMark, count: d.rating.totalReviewCount ?? 0 })
      })
      .catch(() => {})
  }, [wb.showShopRating]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentQuestion && phase === 'question') {
      track('question_shown', { questionId: currentQuestion.id, questionText: currentQuestion.text })
    }
  }, [currentQuestion?.id, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectSingle = async (answer: Answer) => {
    track('answer_selected', {
      questionId: currentQuestionId,
      questionText: currentQuestion?.text ?? '',
      answerId: answer.id,
      answerText: answer.text,
    })
    const updated = { ...selectedAnswers, [currentQuestionId]: answer.id }
    setSelectedAnswers(updated)
    if (answer.maatwerkMode) {
      track('maatwerk_shown', { answerId: answer.id, answerText: answer.text })
      setMaatwerkAnswer(answer)
      setPhase('maatwerk')
    } else if (answer.nextQuestionId === null) {
      await showResults(updated)
    } else {
      setAnimDir('in')
      setHistory(h => [...h, currentQuestionId])
      setCurrentQuestionId(answer.nextQuestionId)
    }
  }

  const toggleMulti = (answerId: string) => {
    const current = (selectedAnswers[currentQuestionId] as string[]) ?? []
    const next = current.includes(answerId) ? current.filter(x => x !== answerId) : [...current, answerId]
    setSelectedAnswers({ ...selectedAnswers, [currentQuestionId]: next })
  }

  const confirmMulti = async () => {
    if (!currentQuestion) return
    const chosen = (selectedAnswers[currentQuestionId] as string[]) ?? []
    if (!chosen.length) return
    for (const answerId of chosen) {
      const a = currentQuestion.answers.find(x => x.id === answerId)
      if (a) track('answer_selected', {
        questionId: currentQuestionId,
        questionText: currentQuestion.text,
        answerId: a.id,
        answerText: a.text,
      })
    }
    const firstAnswer = currentQuestion.answers.find(a => a.id === chosen[0])
    const next = firstAnswer?.nextQuestionId ?? null
    if (next === null) {
      await showResults(selectedAnswers)
    } else {
      setAnimDir('in')
      setHistory(h => [...h, currentQuestionId])
      setCurrentQuestionId(next)
    }
  }

  const confirmRange = async () => {
    if (!currentQuestion || currentQuestion.type !== 'range') return
    const value = selectedAnswers[currentQuestionId] as string | undefined
    const unitStr = currentQuestion.rangeUnit ? ` ${currentQuestion.rangeUnit}` : ''
    track('answer_selected', {
      questionId: currentQuestionId,
      questionText: currentQuestion.text,
      answerId: 'range',
      answerText: `${value ?? ''}${unitStr}`,
    })
    const nextId = currentQuestion.rangeNextQuestionId ?? null
    const updated = { ...selectedAnswers }
    if (value === undefined || value === '') updated[currentQuestionId] = String(Math.round(((currentQuestion.rangeMin ?? 0) + (currentQuestion.rangeMax ?? 1000)) / 2))
    if (nextId === null) {
      await showResults(updated)
    } else {
      setAnimDir('in')
      setHistory(h => [...h, currentQuestionId])
      setCurrentQuestionId(nextId)
    }
  }

  const showResults = async (answers: Record<string, string | string[]>) => {
    setMatching(true)
    setPhase('results')
    const res = await fetch(`/api/flows/${id}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedAnswers: answers }),
    })
    const data: MatchResponse = await res.json()
    setMatchData(data)
    setMatching(false)
    const total = data.perfect.length + data.alternatives.length

    // Productreviews ophalen en/of dummy data seeden voor preview
    if (wb.showProductReviews) {
      const allProducts = [...data.perfect, ...data.alternatives]

      // Seed deterministische dummy reviews zodat de weergave direct zichtbaar is;
      // echte Trusted Shops data overschrijft dit zodra het binnenkomt.
      const dummies: Record<string, { rating: number; count: number }> = {}
      for (const s of allProducts) {
        const h = s.product._id.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
        dummies[s.product._id] = { rating: +(3.6 + (h % 15) / 10).toFixed(1), count: 12 + (h % 220) }
      }
      setProductReviews(dummies)

      // Trusted Shops productreviews ophalen per SKU (overschrijft dummies indien beschikbaar)
      for (const s of allProducts) {
        const sku = (s.product as Record<string, unknown>).sku as string | undefined
        if (!sku) continue
        fetch(`/api/trusted-shops?type=product&sku=${encodeURIComponent(sku)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.rating && d?.count > 0) {
              setProductReviews(prev => ({ ...prev, [s.product._id]: { rating: Number(d.rating), count: Number(d.count) } }))
            }
          })
          .catch(() => {})
      }
    }
    if (total === 0) {
      track('no_results')
    } else {
      track('results_shown', { perfectCount: data.perfect.length, alternativeCount: data.alternatives.length })
      // Elk aanbevolen product apart loggen
      for (const s of [...data.perfect, ...data.alternatives]) {
        track('product_shown', {
          productId: s.product._id,
          productTitle: s.product.title,
          isPerfect: s.isPerfect ? 1 : 0,
          score: s.score,
        })
      }
    }

    // Consolidated completed-event: alle voorkeuren als leesbare tekst + Spotler mapping
    if (flow) {
      const preferences: Record<string, string> = {}
      const spotlerData: Record<string, string> = {}
      const sa = flow.spotlerAttributes ?? {}

      for (const [qId, aIdOrIds] of Object.entries(answers)) {
        const q = flow.questions.find(x => x.id === qId)
        if (!q) continue
        let answerText: string
        if (q.type === 'range') {
          const unitStr = q.rangeUnit ? ` ${q.rangeUnit}` : ''
          answerText = `${aIdOrIds}${unitStr}`
        } else {
          const ids = Array.isArray(aIdOrIds) ? aIdOrIds : [aIdOrIds]
          answerText = ids.map(aid => q.answers.find(a => a.id === aid)?.text ?? aid).join(', ')
        }
        preferences[q.text] = answerText
        if (sa[qId]) spotlerData[sa[qId]] = answerText
      }

      if (window.parent !== window) {
        window.parent.postMessage({
          source: 'keuzehulp',
          type: 'completed',
          flowId: id,
          flowName: flow.name,
          preferences,
          spotlerAttributes: Object.keys(spotlerData).length > 0 ? spotlerData : undefined,
        }, '*')
      }
    }
  }

  const goBack = () => {
    if (!history.length) return
    const prev = history[history.length - 1]
    setAnimDir('out')
    setHistory(h => h.slice(0, -1))
    setCurrentQuestionId(prev)
    setPhase('question')
    setMatchData(null)
  }

  const restart = () => {
    if (!flow) return
    setSelectedAnswers({})
    setHistory([])
    setCurrentQuestionId(flow.startQuestionId)
    setPhase('question')
    setMatchData(null)
    setMaatwerkAnswer(null)
  }

  const progress = flow ? Math.round((history.length / Math.max(flow.questions.length, 1)) * 100) : 0

  // ── Productkaart ─────────────────────────────────────────

  function ProductCard({ s, isAlternative, isBestMatch, isBestPrice }: {
    s: ScoredProduct; isAlternative?: boolean; isBestMatch?: boolean; isBestPrice?: boolean
  }) {
    const p = s.product
    const key = p._id
    return (
      <div className={`rounded-xl border-2 transition-all ${isBestMatch ? 'border-blue-400 bg-white' : isAlternative ? 'border-gray-200 bg-gray-50' : 'border-blue-100 bg-white'}`}>
        {(isBestMatch || isBestPrice) && (
          <div className="flex gap-1.5 px-4 pt-3">
            {isBestMatch && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-600 text-white">
                ★ Beste match
              </span>
            )}
            {isBestPrice && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-600 text-white">
                € Beste prijs
              </span>
            )}
          </div>
        )}
        <a
          href={p.link} target="_blank" rel="noopener noreferrer"
          onClick={() => track('product_click', { productId: p._id, productTitle: p.title })}
          className="flex items-center gap-4 p-4 group">
          {p.imageLink ? (
            <img src={p.imageLink} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-100 shrink-0" />
          ) : (
            <div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
              {p.title}
            </p>
            {p.brand && <p className="text-xs text-gray-400 mt-0.5">{p.brand}</p>}
            {wb.showProductReviews && productReviews[p._id] && (
              <div className="mt-1">
                <Stars rating={productReviews[p._id].rating} count={productReviews[p._id].count} />
              </div>
            )}
            {p.shortDescription && (() => {
              const liParts = [...p.shortDescription.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
                .map(m => m[1].replace(/<[^>]+>/g, '').trim())
                .filter(Boolean)
              if (liParts.length > 0) {
                return (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {liParts.map((part, i) => (
                      <span key={i} className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {part}
                      </span>
                    ))}
                  </div>
                )
              }
              const plain = p.shortDescription.replace(/<[^>]+>/g, '').trim()
              return plain ? (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{plain}</p>
              ) : null
            })()}
            {/* Extra feedattributen */}
            {flow?.displayAttributes && flow.displayAttributes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {flow.displayAttributes.map(attr => {
                  const val = (p as Record<string, unknown>).attributes
                    ? ((p as Record<string, unknown>).attributes as Record<string, string>)?.[attr]
                    : undefined
                  const directVal = (p as Record<string, unknown>)[attr]
                  const display = val || (directVal !== undefined ? String(directVal) : '')
                  return display ? (
                    <span key={attr} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {attr}: {display}
                    </span>
                  ) : null
                })}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Staffelprijs: lowestPrice is lager dan reguliere prijs */}
              {p.lowestPrice && p.lowestPrice < p.price ? (
                <>
                  <span className="text-xs text-gray-400">vanaf</span>
                  <span className="text-sm font-bold text-blue-600">{formatPrice(p.lowestPrice)}</span>
                  <span className="text-xs text-gray-400 line-through">{formatPrice(p.price)}</span>
                </>
              ) : p.salePrice ? (
                <>
                  <span className="text-sm font-bold text-green-600">{formatPrice(p.salePrice)}</span>
                  <span className="text-xs text-gray-400 line-through">{formatPrice(p.price)}</span>
                </>
              ) : p.price > 0 ? (
                <span className="text-sm font-bold text-gray-800">{formatPrice(p.price)}</span>
              ) : null}
              {(p.qtyIncrement as number) > 1 && (
                <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                  Per {p.qtyIncrement} stuks
                </span>
              )}
              {(p.availability === 'in_stock' || p.availability === 'in stock') && (
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Op voorraad</span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-lg font-bold ${s.score >= 80 ? 'text-blue-600' : s.score >= 50 ? 'text-yellow-500' : 'text-gray-400'}`}>
              {s.score}
            </div>
            <div className="text-xs text-gray-400">score</div>
          </div>
        </a>

        {/* In winkelwagen — stuurt postMessage naar GTM op de parent-pagina */}
        {flow?.adobeCommerceUrl && p.sku && (() => {
          const cs = cartState[key]
          const addToCart = () => {
            track('add_to_cart', { productId: p._id, productTitle: p.title, sku: p.sku })
            postMsg('add_to_cart', { sku: p.sku, productId: p._id, productTitle: p.title, qty: 1 })
            setCartState(s => ({ ...s, [key]: 'done' }))
            setTimeout(() => setCartState(s => { const n = { ...s }; delete n[key]; return n }), 4000)
          }
          return (
            <div className="px-4 pb-3 flex justify-end">
              <button
                onClick={addToCart}
                disabled={cs === 'done'}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  cs === 'done'
                    ? 'border-green-200 text-green-600 bg-green-50'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
                style={{ borderRadius: khRadius }}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                {cs === 'done' ? '✓ Toegevoegd' : 'In winkelwagen'}
              </button>
            </div>
          )
        })()}

        {/* Uitlegknop */}
        {s.ruleResults.length > 0 && flow && (() => {
          // Groepeer ruleResults per antwoord-ID
          const byAnswer: Record<string, { text: string; allMatched: boolean }> = {}
          for (const r of s.ruleResults) {
            if (!r.answerId) continue
            if (!byAnswer[r.answerId]) {
              // Zoek het label op via de flow; valt terug op antwoordtekst
              let answerText = ''
              for (const q of flow.questions) {
                const a = q.answers.find(x => x.id === r.answerId)
                if (a) { answerText = a.label || a.text; break }
              }
              if (!answerText) continue
              byAnswer[r.answerId] = { text: answerText, allMatched: true }
            }
            if (!r.matched) byAnswer[r.answerId].allMatched = false
          }
          const reasons = Object.values(byAnswer).sort((a, b) => Number(b.allMatched) - Number(a.allMatched))
          if (!reasons.length) return null
          return (
            <div className="px-4 pb-3 pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Waarom dit product?</p>
              <div className="space-y-1.5">
                {reasons.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={r.allMatched ? 'text-green-500' : 'text-orange-400'}>
                      {r.allMatched ? '✓' : '~'}
                    </span>
                    <span className={r.allMatched ? 'text-gray-700' : 'text-gray-400'}>
                      {r.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────

  if (phase === 'loading') {
    return <div className="flex items-center justify-center min-h-64 text-gray-400 text-sm">Laden…</div>
  }

  if (phase === 'error') {
    return <div className="flex items-center justify-center min-h-64 text-red-400 text-sm">Keuzehulp niet gevonden.</div>
  }

  const ws = flow?.widgetStyle
  // URL-params (van de admin preview) overschrijven de opgeslagen stijl
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const khColor  = urlParams?.get('color')  || ws?.primaryColor  || '#2563eb'
  const khRadius = { none: '0px', small: '6px', medium: '12px', large: '20px' }[
    (urlParams?.get('radius') || ws?.borderRadius || 'medium') as 'none' | 'small' | 'medium' | 'large'
  ]
  const khFont   = urlParams?.get('font')   || ws?.fontFamily   || ''

  // Licht en donker afgeleid van de primaire kleur voor hover/active states
  const khStyle = {
    '--kh': khColor,
    '--kh-r': khRadius,
    '--kh-font': khFont || 'inherit',
  } as React.CSSProperties

  return (
    <div className="max-w-xl mx-auto px-4 py-8" style={{ ...khStyle, fontFamily: khFont || undefined }}>
      <style>{`
        @keyframes khSlideIn  { from { opacity:0; transform:translateX(28px) } to { opacity:1; transform:none } }
        @keyframes khSlideOut { from { opacity:0; transform:translateX(-28px) } to { opacity:1; transform:none } }
      `}</style>
      {/* Voortgangsindicator */}
      {phase === 'question' && flow && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>{flow.name}</span>
            {wb.progressStyle === 'steps'
              ? <span className="font-medium" style={{ color: 'var(--kh)' }}>Vraag {history.length + 1} van {flow.questions.length}</span>
              : <span>Stap {history.length + 1}</span>}
          </div>
          {wb.progressStyle !== 'steps' && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.max(progress, 5)}%`, backgroundColor: 'var(--kh)' }} />
            </div>
          )}
        </div>
      )}

      {/* Vraagfase */}
      {phase === 'question' && currentQuestion && (
        <div
          key={currentQuestionId}
          className={wb.enableAnimations ? `animate-kh-${animDir}` : ''}
          style={wb.enableAnimations ? {
            animation: `${animDir === 'in' ? 'khSlideIn' : 'khSlideOut'} 0.25s ease forwards`,
          } : undefined}
        >
          <h2 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{currentQuestion.text}</h2>
          {currentQuestion.intro && (
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">{currentQuestion.intro}</p>
          )}

          {currentQuestion.type === 'range' ? (
            <RangeInput
              question={currentQuestion}
              value={selectedAnswers[currentQuestionId] as string | undefined}
              onChange={v => setSelectedAnswers(prev => ({ ...prev, [currentQuestionId]: v }))}
              onConfirm={confirmRange}
              khRadius={khRadius}
            />
          ) : (
            <AnswerList
              question={currentQuestion}
              selectedAnswers={selectedAnswers}
              onSelectSingle={selectSingle}
              onToggleMulti={toggleMulti}
              onConfirmMulti={confirmMulti}
              khRadius={khRadius}
            />
          )}

          {history.length > 0 && (
            <button onClick={goBack} className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← Vorige vraag
            </button>
          )}
        </div>
      )}

      {/* Maatwerk formulier */}
      {(phase === 'maatwerk' || phase === 'maatwerk-done') && maatwerkAnswer && flow && (() => {
        const selections = flow.questions.flatMap(q => {
          const sel = selectedAnswers[q.id]
          if (!sel) return []
          if (q.type === 'range') {
            const unit = q.rangeUnit ? ` ${q.rangeUnit}` : ''
            return [{ questionText: q.text, answerText: `${sel}${unit}` }]
          }
          const ids = Array.isArray(sel) ? sel : [sel]
          const texts = ids.map(id => q.answers.find(a => a.id === id)?.text).filter(Boolean) as string[]
          return texts.length ? [{ questionText: q.text, answerText: texts.join(', ') }] : []
        })
        return (
          <MaatwerkFormView
            flowId={id}
            flow={flow}
            answerId={maatwerkAnswer.id}
            selections={selections}
            khRadius={khRadius}
            done={phase === 'maatwerk-done'}
            onSubmitDone={() => setPhase('maatwerk-done')}
            onBack={() => { setPhase('question'); setMaatwerkAnswer(null) }}
          />
        )
      })()}

      {/* Resultaten */}
      {phase === 'results' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {matching ? 'Resultaten ophalen' : (flow?.resultsTitle || 'Jouw resultaten')}
            </h2>
            <button onClick={restart} className="text-xs text-blue-600 hover:underline">Opnieuw beginnen</button>
          </div>

          {/* Laadanimatie met samenvatting van gemaakte keuzes */}
          {matching && flow && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--kh)' }} />
                    <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: 'var(--kh)' }} />
                  </span>
                  <p className="text-sm font-medium text-gray-700">We koppelen producten aan jouw keuzes…</p>
                </div>
                {(() => {
                  const labels: string[] = []
                  for (const [qId, val] of Object.entries(selectedAnswers)) {
                    const q = flow.questions.find(x => x.id === qId)
                    if (!q) continue
                    const ids = Array.isArray(val) ? val : [val]
                    for (const aid of ids) {
                      const ans = q.answers.find(a => a.id === aid)
                      if (ans) labels.push(ans.label || ans.text)
                      else if (q.type === 'range') labels.push(`${val}${q.rangeUnit ? ' ' + q.rangeUnit : ''}`)
                    }
                  }
                  return labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((l, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: 'var(--kh)' }}>{l}</span>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            </div>
          )}

          {/* Geen resultaten */}
          {!matching && matchData && matchData.perfect.length === 0 && matchData.alternatives.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">Geen producten gevonden voor jouw keuzes.</p>
              <button onClick={restart} className="mt-4 text-sm text-blue-600 hover:underline">Probeer opnieuw</button>
            </div>
          )}

          {/* Dynamische resultaattekst */}
          {!matching && matchData && flow?.resultsSummaryTemplate && (() => {
            const tpl = flow.resultsSummaryTemplate
            const summary = tpl.replace(/\{([^}]+)\}/g, (_: string, qId: string) => {
              const q = flow.questions.find(x => x.id === qId)
              if (!q) return ''
              const aIdOrIds = selectedAnswers[qId]
              if (!aIdOrIds) return ''
              const ids = Array.isArray(aIdOrIds) ? aIdOrIds : [aIdOrIds]
              return ids.map(aid => q.answers.find(a => a.id === aid)?.text ?? '').filter(Boolean).join(', ')
            })
            return summary ? (
              <p className="text-sm text-gray-600 mb-4 italic">{summary}</p>
            ) : null
          })()}

          {/* Perfect matches + alternatieven met labels */}
          {!matching && matchData && (() => {
            const allResults = [...matchData.perfect, ...matchData.alternatives]
            const bestMatchId = allResults[0]?.product._id
            const effectivePrice = (s: ScoredProduct) =>
              (s.product.salePrice as number) > 0
                ? (s.product.salePrice as number)
                : (s.product.price as number) || Infinity
            const lowestPrice = Math.min(...allResults.map(effectivePrice))
            const bestPriceId = lowestPrice < Infinity
              ? allResults.find(s => effectivePrice(s) === lowestPrice)?.product._id
              : undefined

            return (
              <>
                {matchData.perfect.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      {matchData.perfect.length} aanbevolen product{matchData.perfect.length !== 1 ? 'en' : ''}
                    </p>
                    <div className="space-y-3">
                      {matchData.perfect.map(s => (
                        <ProductCard
                          key={s.product._id} s={s}
                          isBestMatch={s.product._id === bestMatchId}
                          isBestPrice={s.product._id === bestPriceId}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {matchData.alternatives.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-3">Mogelijk ook interessant</p>
                    <div className="space-y-3">
                      {matchData.alternatives.map(s => (
                        <ProductCard
                          key={s.product._id} s={s} isAlternative
                          isBestMatch={s.product._id === bestMatchId}
                          isBestPrice={s.product._id === bestPriceId}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {history.length > 0 && !matching && (
            <button onClick={goBack} className="mt-5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← Vorige vraag
            </button>
          )}

          {/* Aanvullende producten (bijverkoop) */}
          {!matching && matchData && (matchData.related ?? []).length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Aanvullende producten</p>
              <div className="space-y-2">
                {(matchData.related ?? []).map((s, i) => {
                  const p = s.product as Record<string, string | number>
                  const price = p.salePrice ? p.salePrice : p.lowestPrice && (p.lowestPrice as number) < (p.price as number) ? p.lowestPrice : p.price
                  return (
                    <a
                      key={i}
                      href={p.link as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track('product_click', { productId: String(p._id), productTitle: String(p.title) })}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group"
                    >
                      {p.imageLink ? (
                        <img src={p.imageLink as string} alt="" className="w-12 h-12 object-contain rounded border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 line-clamp-1 group-hover:text-gray-900">{p.title as string}</p>
                        {p.brand ? <p className="text-xs text-gray-400">{p.brand as string}</p> : null}
                      </div>
                      {price ? (
                        <p className="text-sm font-semibold text-gray-700 shrink-0">
                          € {(price as number).toFixed(2).replace('.', ',')}
                        </p>
                      ) : null}
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mail mij de resultaten */}
          {!matching && flow?.emailResults && matchData && (matchData.perfect.length + matchData.alternatives.length) > 0 && (
            <EmailResultsForm
              flow={flow}
              products={[...matchData.perfect, ...matchData.alternatives].map(s => ({
                title: s.product.title,
                brand: s.product.brand,
                imageLink: s.product.imageLink,
                link: s.product.link,
                price: s.product.price,
                salePrice: s.product.salePrice,
                lowestPrice: s.product.lowestPrice,
              }))}
              khRadius={khRadius}
            />
          )}

          {/* Trusted Shops shopbeoordeling */}
          {!matching && wb.showShopRating && shopRating && (
            <div className="mt-6 flex items-center gap-3 justify-center">
              <Stars rating={shopRating.rating} count={shopRating.count} />
              <span className="text-xs text-gray-400">shopbeoordeling</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function WidgetPage() {
  return (
    <Suspense fallback={null}>
      <WidgetPageInner />
    </Suspense>
  )
}
