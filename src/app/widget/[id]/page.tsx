'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'

interface Answer {
  id: string
  text: string
  imageUrl: string
  nextQuestionId: string | null
  matchRules: { field: string; operator: string; value: string }[]
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

interface Flow {
  _id: string
  name: string
  description: string
  startQuestionId: string
  questions: Question[]
  adobeCommerceUrl?: string
}

interface RuleResult {
  field: string
  operator: string
  value: string
  matched: boolean
  productValue: string
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
}

type Phase = 'loading' | 'question' | 'results' | 'error'

const OPERATOR_NL: Record<string, string> = {
  contains: 'bevat',
  notContains: 'bevat niet',
  equals: 'is',
  startsWith: 'begint met',
}

const FIELD_NL: Record<string, string> = {
  category: 'Categorie',
  brand: 'Merk',
  title: 'Titel',
  availability: 'Beschikbaarheid',
}

// ── Layout-helpers ───────────────────────────────────────────────────────────

function answerWrapperClass(layout: AnswerLayout) {
  if (layout === 'image') return 'grid grid-cols-2 gap-3'
  if (layout === 'size')  return 'flex flex-wrap gap-2'
  return 'space-y-3'
}

function singleBtnClass(layout: AnswerLayout, active = false) {
  const base = 'transition-all font-medium text-sm border-2 '
  if (layout === 'image')      return base + 'rounded-xl overflow-hidden flex flex-col ' + (active ? 'border-blue-500' : 'border-gray-200 hover:border-blue-400')
  if (layout === 'image-text') return base + 'w-full text-left rounded-xl flex items-center gap-3 p-3 ' + (active ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 hover:border-blue-400 text-gray-800')
  if (layout === 'size')       return base + 'rounded-lg px-4 py-2 ' + (active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-blue-400 text-gray-700')
  return base + 'w-full text-left px-5 py-4 rounded-xl flex items-center gap-3 ' + (active ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 hover:border-blue-400 text-gray-800')
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

function AnswerList({
  question,
  selectedAnswers,
  onSelectSingle,
  onToggleMulti,
  onConfirmMulti,
}: {
  question: Question
  selectedAnswers: Record<string, string | string[]>
  onSelectSingle: (a: Answer) => void
  onToggleMulti: (id: string) => void
  onConfirmMulti: () => void
}) {
  const layout = question.layout ?? 'text'
  const wrapperClass = answerWrapperClass(layout)

  if (question.type === 'single') {
    return (
      <div className={wrapperClass}>
        {question.answers.map(a => (
          <button key={a.id} onClick={() => onSelectSingle(a)} className={singleBtnClass(layout)}>
            <AnswerContent a={a} layout={layout} />
          </button>
        ))}
      </div>
    )
  }

  // multi
  const chosen = (selectedAnswers[question.id] as string[]) ?? []
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Selecteer alles wat van toepassing is.</p>
      <div className={wrapperClass}>
        {question.answers.map(a => {
          const selected = chosen.includes(a.id)
          return (
            <button key={a.id} onClick={() => onToggleMulti(a.id)}
              className={singleBtnClass(layout, selected) + (layout === 'text' || layout === 'image-text' ? ' relative' : '')}>
              {(layout === 'text' || layout === 'image-text') && (
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                  {selected && <span className="text-white text-xs">✓</span>}
                </span>
              )}
              {layout === 'size' && selected && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">✓</span>
              )}
              <AnswerContent a={a} layout={layout} />
            </button>
          )
        })}
      </div>
      <button onClick={onConfirmMulti}
        disabled={!chosen.length}
        className="mt-5 w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors">
        Volgende →
      </button>
    </div>
  )
}

// ── Hoofdpagina ──────────────────────────────────────────────────────────────

export default function WidgetPage() {
  const { id } = useParams<{ id: string }>()

  const [flow, setFlow] = useState<Flow | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [currentQuestionId, setCurrentQuestionId] = useState('')
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | string[]>>({})
  const [history, setHistory] = useState<string[]>([])
  const [matchData, setMatchData] = useState<MatchResponse | null>(null)
  const [matching, setMatching] = useState(false)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [cartState, setCartState] = useState<Record<string, 'adding' | 'done' | 'error'>>({})

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

  const currentQuestion = flow?.questions.find(q => q.id === currentQuestionId)
  const formatPrice = (p: number) => `€ ${p.toFixed(2).replace('.', ',')}`

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
    if (answer.nextQuestionId === null) {
      await showResults(updated)
    } else {
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
      setHistory(h => [...h, currentQuestionId])
      setCurrentQuestionId(next)
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
    if (total === 0) {
      track('no_results')
    } else {
      track('results_shown', { perfectCount: data.perfect.length, alternativeCount: data.alternatives.length })
    }
  }

  const goBack = () => {
    if (!history.length) return
    const prev = history[history.length - 1]
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
    setExpandedProduct(null)
  }

  const progress = flow ? Math.round((history.length / Math.max(flow.questions.length, 1)) * 100) : 0

  // ── Productkaart ─────────────────────────────────────────

  function ProductCard({ s, isAlternative, isBestMatch, isBestPrice }: {
    s: ScoredProduct; isAlternative?: boolean; isBestMatch?: boolean; isBestPrice?: boolean
  }) {
    const p = s.product
    const key = p._id
    const isExpanded = expandedProduct === key

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
            {p.shortDescription && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.shortDescription}</p>
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
              {p.availability === 'in stock' && (
                <span className="text-xs text-green-600 font-medium">Op voorraad</span>
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
            <div className="px-4 pb-3">
              <button
                onClick={addToCart}
                disabled={cs === 'done'}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  cs === 'done' ? 'bg-green-100 text-green-700' :
                  'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {cs === 'done' ? '✓ Toegevoegd' : 'In winkelwagen'}
              </button>
            </div>
          )
        })()}

        {/* Uitlegknop */}
        {s.ruleResults.length > 0 && (
          <div className="px-4 pb-3 border-t border-gray-100">
            <button
              onClick={() => setExpandedProduct(isExpanded ? null : key)}
              className="text-xs text-blue-500 hover:underline mt-2"
            >
              {isExpanded ? 'Verberg uitleg ▲' : 'Waarom dit product? ▼'}
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-1.5">
                {s.ruleResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={r.matched ? 'text-green-500' : 'text-red-400'}>
                      {r.matched ? '✓' : '✗'}
                    </span>
                    <span className="text-gray-500">
                      {FIELD_NL[r.field] ?? r.field} {OPERATOR_NL[r.operator] ?? r.operator}{' '}
                      <strong>"{r.value}"</strong>
                    </span>
                    {!r.matched && r.productValue && (
                      <span className="text-gray-400">(is: "{r.productValue}")</span>
                    )}
                  </div>
                ))}
                {s.boostBreakdown.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-blue-500">
                    <span>↑</span>
                    <span>{b.label} +{b.points} punten</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

  return (
    <div className="max-w-xl mx-auto px-4 py-8 font-sans">
      {/* Voortgangsbalk */}
      {phase === 'question' && flow && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>{flow.name}</span>
            <span>Stap {history.length + 1}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.max(progress, 5)}%` }} />
          </div>
        </div>
      )}

      {/* Vraagfase */}
      {phase === 'question' && currentQuestion && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6 leading-snug">{currentQuestion.text}</h2>

          <AnswerList
            question={currentQuestion}
            selectedAnswers={selectedAnswers}
            onSelectSingle={selectSingle}
            onToggleMulti={toggleMulti}
            onConfirmMulti={confirmMulti}
          />

          {history.length > 0 && (
            <button onClick={goBack} className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← Vorige vraag
            </button>
          )}
        </div>
      )}

      {/* Resultaten */}
      {phase === 'results' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {matching ? 'Zoeken…' : 'Jouw resultaten'}
            </h2>
            <button onClick={restart} className="text-xs text-blue-600 hover:underline">Opnieuw beginnen</button>
          </div>

          {/* Zoekcriteria samenvatting */}
          {!matching && matchData && matchData.searchCriteria.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs font-semibold text-blue-700 mb-1.5">Je bent op zoek naar:</p>
              <ul className="space-y-0.5">
                {matchData.searchCriteria.map((c, i) => {
                  const [field, ...rest] = c.split(' ')
                  const fieldNl = FIELD_NL[field] ?? field
                  return (
                    <li key={i} className="text-xs text-blue-600">
                      • {fieldNl} {rest.join(' ')}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Laadanimatie */}
          {matching && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
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
        </div>
      )}
    </div>
  )
}
