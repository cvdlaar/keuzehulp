'use client'

import { useEffect, useState, useCallback } from 'react'

interface Product {
  _id: string
  externalId: string
  title: string
  brand: string
  category: string
  price: number
  salePrice: number | null
  lowestPrice: number | null
  shortDescription: string
  availability: string
  imageLink: string
  link: string
  ean: string
}

interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  pages: number
}

export default function ProductenPage() {
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [availability, setAvailability] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
          <option value="in stock">Op voorraad</option>
          <option value="out of stock">Niet op voorraad</option>
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
                <tr key={p._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {p.imageLink ? (
                      <img src={p.imageLink} alt="" className="w-10 h-10 object-contain rounded border border-gray-100" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 text-xs">—</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-blue-600 line-clamp-2">
                      {p.title}
                    </a>
                    {p.shortDescription && (
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{p.shortDescription}</p>
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
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.availability === 'in stock' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {p.availability || '—'}
                    </span>
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
    </div>
  )
}
