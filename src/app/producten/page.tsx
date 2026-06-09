'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Product {
  _id: string
  externalId: string
  title: string
  brand: string
  category: string
  price: number
  salePrice: number | null
  lowestPrice: number | null
  description: string
  shortDescription: string
  availability: string
  imageLink: string
  link: string
  ean: string
  sku: string
  qtyIncrement: number
  attributes: Record<string, string>
  updatedAt: string
}

interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  pages: number
}

interface ProductStats {
  shown: number
  clicks: number
  addToCarts: number
}

interface FlowRef {
  id: string
  name: string
}

interface ProductDetail {
  product: Product
  stats: ProductStats
  flows: FlowRef[]
}

const isInStock = (availability: string) =>
  availability === 'in_stock' || availability === 'in stock' || availability === 'op voorraad'

export default function ProductenPage() {
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [availability, setAvailability] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    if (availability) params.set('availability', availability)
    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [page, search, category, availability])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    setDetailLoading(true)
    fetch(`/api/products/${selectedId}/stats`)
      .then((r) => r.json())
      .then((d) => { setDetail(d); setDetailLoading(false) })
  }, [selectedId])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    load()
  }

  const handleDeleteAll = async () => {
    if (!confirm('Weet je zeker dat je ALLE producten wilt verwijderen?')) return
    setDeleting(true)
    await fetch('/api/products', { method: 'DELETE' })
    setDeleting(false)
    load()
  }

  const formatPrice = (p: number) =>
    p ? `€ ${p.toFixed(2).replace('.', ',')}` : '—'

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Producten</h1>
          <p className="text-gray-500">
            {data ? `${data.total.toLocaleString('nl-NL')} producten in de database` : 'Laden…'}
          </p>
        </div>
        <button
          onClick={handleDeleteAll}
          disabled={deleting}
          className="px-4 py-2 text-sm font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {deleting ? 'Verwijderen…' : 'Alle producten wissen'}
        </button>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoeken op titel, merk of ID…"
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Categorie…"
          className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Alle beschikbaarheid</option>
          <option value="in_stock">Op voorraad</option>
          <option value="out_of_stock">Niet op voorraad</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Zoeken
        </button>
      </form>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && <p className="text-gray-400 text-sm p-6">Laden…</p>}
        {!loading && data && data.products.length === 0 && (
          <p className="text-gray-400 text-sm p-6">Geen producten gevonden.</p>
        )}
        {!loading && data && data.products.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Afbeelding</th>
                <th className="px-4 py-3 font-medium">Titel</th>
                <th className="px-4 py-3 font-medium">Merk</th>
                <th className="px-4 py-3 font-medium">Categorie</th>
                <th className="px-4 py-3 font-medium">Prijs</th>
                <th className="px-4 py-3 font-medium">Beschikbaarheid</th>
                <th className="px-4 py-3 font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => (
                <tr
                  key={p._id}
                  onClick={() => setSelectedId(p._id === selectedId ? null : p._id)}
                  className={`border-b border-gray-50 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors ${selectedId === p._id ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}`}
                >
                  <td className="px-4 py-3">
                    {p.imageLink ? (
                      <img src={p.imageLink} alt="" className="w-10 h-10 object-contain rounded border border-gray-100" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-xs">—</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 line-clamp-2">{p.title}</span>
                    {p.shortDescription && (
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                        {p.shortDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.brand || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-36 truncate">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {p.lowestPrice && p.lowestPrice < p.price ? (
                      <span>
                        <span className="text-xs text-gray-400 mr-1">vanaf</span>
                        <span className="text-blue-600 font-medium">{formatPrice(p.lowestPrice)}</span>
                        <span className="line-through text-gray-400 ml-1 text-xs">{formatPrice(p.price)}</span>
                      </span>
                    ) : p.salePrice ? (
                      <span>
                        <span className="line-through text-gray-400 mr-1">{formatPrice(p.price)}</span>
                        <span className="text-green-600 font-medium">{formatPrice(p.salePrice)}</span>
                      </span>
                    ) : formatPrice(p.price)}
                  </td>
                  <td className="px-4 py-3">
                    {isInStock(p.availability) ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                        <span>✓</span> Op voorraad
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <span>✕</span> Niet op voorraad
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.externalId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginering */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Pagina {data.page} van {data.pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              ← Vorige
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Volgende →
            </button>
          </div>
        </div>
      )}

      {/* Product detail drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedId(null)} />
          <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl border-l border-gray-200">
            {detailLoading || !detail ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Laden…</div>
            ) : (
              <ProductDetailPanel
                detail={detail}
                onClose={() => setSelectedId(null)}
                formatPrice={formatPrice}
                onAttributesUpdated={(id, attrs) => {
                  setDetail(d => d ? { ...d, product: { ...d.product, attributes: attrs } } : d)
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProductDetailPanel({
  detail,
  onClose,
  formatPrice,
  onAttributesUpdated,
}: {
  detail: ProductDetail
  onClose: () => void
  formatPrice: (p: number) => string
  onAttributesUpdated: (id: string, attrs: Record<string, string>) => void
}) {
  const { product: p, stats, flows } = detail
  const attributes = p.attributes ? Object.entries(p.attributes) : []

  const [editingAttrs, setEditingAttrs] = useState(false)
  const [attrRows, setAttrRows] = useState<{ key: string; value: string }[]>([])
  const [savingAttrs, setSavingAttrs] = useState(false)

  const startEdit = () => {
    setAttrRows(
      attributes.length > 0
        ? attributes.map(([k, v]) => ({ key: k, value: String(v) }))
        : [{ key: '', value: '' }]
    )
    setEditingAttrs(true)
  }

  const saveAttrs = async () => {
    setSavingAttrs(true)
    const obj: Record<string, string> = {}
    for (const { key, value } of attrRows) {
      if (key.trim()) obj[key.trim()] = value
    }
    await fetch(`/api/products/${p._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: obj }),
    })
    onAttributesUpdated(p._id, obj)
    setEditingAttrs(false)
    setSavingAttrs(false)
  }

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
        <span className="text-sm font-medium text-gray-700">Productdetails</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
          aria-label="Sluiten"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Afbeelding + titel */}
        <div className="flex gap-4">
          {p.imageLink ? (
            <img
              src={p.imageLink}
              alt=""
              className="w-24 h-24 object-contain rounded-lg border border-gray-100 flex-shrink-0 bg-gray-50"
            />
          ) : (
            <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-300 text-xs flex-shrink-0">
              Geen afb.
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 text-base leading-snug mb-2">{p.title}</h2>
            <div className="flex flex-wrap gap-1.5">
              {p.brand && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{p.brand}</span>
              )}
              {p.category && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{p.category}</span>
              )}
              {isInStock(p.availability) ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                  <span>✓</span> Op voorraad
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">
                  <span>✕</span> Niet op voorraad
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Prijs */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Prijs</div>
          {p.lowestPrice && p.lowestPrice < p.price ? (
            <div>
              <span className="text-sm text-gray-400 mr-2">Vanaf</span>
              <span className="text-xl font-bold text-blue-600">{formatPrice(p.lowestPrice)}</span>
              <span className="line-through text-gray-400 ml-2 text-sm">{formatPrice(p.price)}</span>
            </div>
          ) : p.salePrice ? (
            <div>
              <span className="line-through text-gray-400 mr-2">{formatPrice(p.price)}</span>
              <span className="text-xl font-bold text-green-600">{formatPrice(p.salePrice)}</span>
            </div>
          ) : (
            <span className="text-xl font-bold text-gray-900">{formatPrice(p.price)}</span>
          )}
        </div>

        {/* Statistieken */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Statistieken</h3>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Getoond" value={stats.shown} color="blue" />
            <StatCard label="Geklikt" value={stats.clicks} color="purple" />
            <StatCard label="In winkelwagen" value={stats.addToCarts} color="green" />
          </div>
          {stats.shown > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Click-through: {Math.round((stats.clicks / stats.shown) * 100)}%
              {stats.clicks > 0 && ` · Cart rate: ${Math.round((stats.addToCarts / stats.clicks) * 100)}%`}
            </p>
          )}
        </div>

        {/* In configurators */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">In configurators</h3>
          {flows.length === 0 ? (
            <p className="text-sm text-gray-400">Niet vastgezet in een configurator.</p>
          ) : (
            <div className="space-y-2">
              {flows.map((f) => (
                <Link
                  key={f.id}
                  href={`/beheer/flows/${f.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <span className="text-sm text-gray-700 group-hover:text-blue-700">{f.name}</span>
                  <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Productinformatie */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Productinformatie</h3>
          <dl className="space-y-2.5 text-sm">
            {p.link && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 flex-shrink-0">Link</dt>
                <dd>
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Bekijk product ↗
                  </a>
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-400 w-32 flex-shrink-0">Extern ID</dt>
              <dd className="font-mono text-gray-700 text-xs break-all">{p.externalId}</dd>
            </div>
            {p.qtyIncrement > 1 && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 flex-shrink-0">Verkoophoeveelheid</dt>
                <dd className="text-gray-700">Per {p.qtyIncrement} stuks</dd>
              </div>
            )}
            {p.ean && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 flex-shrink-0">EAN</dt>
                <dd className="font-mono text-gray-700 text-xs">{p.ean}</dd>
              </div>
            )}
            {p.sku && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 flex-shrink-0">SKU</dt>
                <dd className="font-mono text-gray-700 text-xs">{p.sku}</dd>
              </div>
            )}
            {p.shortDescription && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 flex-shrink-0">Omschrijving</dt>
                <dd
                  className="text-gray-700 text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-0.5"
                  dangerouslySetInnerHTML={{ __html: p.shortDescription }}
                />
              </div>
            )}
            {p.description && p.description !== p.shortDescription && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 flex-shrink-0">Volledige beschr.</dt>
                <dd
                  className="text-gray-700 text-sm line-clamp-6"
                  dangerouslySetInnerHTML={{ __html: p.description }}
                />
              </div>
            )}
            {p.updatedAt && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 flex-shrink-0">Bijgewerkt</dt>
                <dd className="text-gray-600">{new Date(p.updatedAt).toLocaleDateString('nl-NL')}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Attributen */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Attributen {attributes.length > 0 && `(${attributes.length})`}
            </h3>
            {!editingAttrs && (
              <button onClick={startEdit} className="text-xs text-blue-600 hover:underline">
                {attributes.length === 0 ? '+ Toevoegen' : 'Bewerken'}
              </button>
            )}
          </div>

          {editingAttrs ? (
            <div className="space-y-2">
              {attrRows.map((row, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    value={row.key}
                    onChange={e => setAttrRows(rows => rows.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                    placeholder="veldnaam"
                    className="w-32 flex-shrink-0 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <input
                    value={row.value}
                    onChange={e => setAttrRows(rows => rows.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                    placeholder="waarde"
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => setAttrRows(rows => rows.filter((_, j) => j !== i))}
                    className="text-gray-300 hover:text-red-400 px-1 text-sm leading-none flex-shrink-0"
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => setAttrRows(rows => [...rows, { key: '', value: '' }])}
                className="text-xs text-blue-600 hover:underline"
              >+ Rij toevoegen</button>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveAttrs} disabled={savingAttrs}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingAttrs ? 'Opslaan…' : 'Opslaan'}
                </button>
                <button
                  onClick={() => setEditingAttrs(false)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                >
                  Annuleren
                </button>
              </div>
            </div>
          ) : attributes.length > 0 ? (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {attributes.map(([key, val]) => (
                    <tr key={key} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 text-gray-400 font-medium bg-gray-50 w-36 align-top">{key}</td>
                      <td className="px-3 py-2 text-gray-700">{String(val) || <span className="text-gray-300 italic">leeg</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Geen attributen. Klik &apos;Toevoegen&apos; om handmatig data in te voeren.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'purple' | 'green' }) {
  const styles = {
    blue:   { bg: 'bg-blue-50',   label: 'text-blue-600',   value: 'text-blue-900' },
    purple: { bg: 'bg-purple-50', label: 'text-purple-600', value: 'text-purple-900' },
    green:  { bg: 'bg-green-50',  label: 'text-green-600',  value: 'text-green-900' },
  }
  const s = styles[color]
  return (
    <div className={`${s.bg} rounded-lg p-3 text-center`}>
      <div className={`text-2xl font-bold ${s.value}`}>{value.toLocaleString('nl-NL')}</div>
      <div className={`text-xs ${s.label} mt-0.5`}>{label}</div>
    </div>
  )
}
