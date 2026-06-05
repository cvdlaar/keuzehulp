'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isWidget = pathname.startsWith('/widget')
  const isLogin = pathname === '/login'

  if (isWidget || isLogin) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
