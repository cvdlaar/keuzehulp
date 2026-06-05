'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { logout } from '@/app/actions/auth'

const baseNav = [
  { href: '/', label: 'Dashboard', icon: '▦' },
  { href: '/feed', label: 'Feed configuratie', icon: '⚙' },
  { href: '/producten', label: 'Producten', icon: '☰' },
  { href: '/logs', label: 'Import logs', icon: '📋' },
  { href: '/beheer/flows', label: 'Keuzehulpen', icon: '❓' },
]

const keyUserNav = { href: '/beheer/gebruikers', label: 'Gebruikers', icon: '👤' }

export default function Sidebar() {
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [me, setMe] = useState<{ name: string; role: string } | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(setMe)
  }, [])

  const nav = me?.role === 'keyuser' ? [...baseNav, keyUserNav] : baseNav

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-6 border-b border-gray-700">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Keuzehulp</p>
        <p className="text-lg font-bold mt-1">Admin</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-gray-700 space-y-2">
        {me && (
          <p className="text-xs text-gray-400 truncate">
            {me.name}
            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs">
              {me.role === 'keyuser' ? 'Key user' : 'Gebruiker'}
            </span>
          </p>
        )}
        <form action={() => startTransition(() => logout())}>
          <button
            type="submit" disabled={pending}
            className="w-full text-left text-xs text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {pending ? 'Uitloggen…' : '← Uitloggen'}
          </button>
        </form>
      </div>
    </aside>
  )
}
