'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { logout } from '@/app/actions/auth'

const baseNav = [
  { href: '/', label: 'Dashboard', icon: '▦' },
  { href: '/feed', label: 'Feed configuratie', icon: '⚙' },
  { href: '/producten', label: 'Producten', icon: '☰' },
  { href: '/attributen', label: 'Attributen', icon: '⊞' },
  { href: '/logs', label: 'Import logs', icon: '📋' },
  { href: '/beheer/flows', label: 'Keuzehulpen', icon: '❓' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [me, setMe] = useState<{ name: string; role: string } | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(setMe)
  }, [])

  const isAdmin = me?.role === 'admin'

  return (
    <aside className="w-56 min-h-screen text-white flex flex-col" style={{ backgroundColor: '#003a70' }}>
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-widest text-white/60">Logistiekconcurrent</span>
        </div>
        <p className="text-lg font-bold" style={{ color: '#e57200' }}>Keuzehulp</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {baseNav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              style={active ? { backgroundColor: '#005eb8' } : {}}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10 space-y-2">
        {isAdmin && (
          <>
            <Link
              href="/beheer/gebruikers"
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/beheer/gebruikers'
                  ? 'text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              style={pathname === '/beheer/gebruikers' ? { backgroundColor: '#005eb8' } : {}}
            >
              Gebruikers
            </Link>
            <Link
              href="/instellingen"
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/instellingen'
                  ? 'text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              style={pathname === '/instellingen' ? { backgroundColor: '#005eb8' } : {}}
            >
              Instellingen
            </Link>
          </>
        )}
        {me && (
          <p className="text-xs text-white/50 truncate px-3">
            {me.name}
            <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#e57200', color: 'white' }}>
              {me.role === 'admin' ? 'Admin' : me.role === 'keyuser' ? 'Key user' : 'Gebruiker'}
            </span>
          </p>
        )}
        <form action={() => startTransition(() => logout())}>
          <button
            type="submit" disabled={pending}
            className="w-full text-left text-xs text-white/50 hover:text-white transition-colors disabled:opacity-50 px-3"
          >
            {pending ? 'Uitloggen…' : '← Uitloggen'}
          </button>
        </form>
      </div>
    </aside>
  )
}
