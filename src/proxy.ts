import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const PUBLIC_PREFIXES = ['/login', '/setup', '/demo', '/widget', '/_next', '/favicon.ico']

// API routes die altijd publiek zijn (widget + bootstrap + tracking)
const PUBLIC_API = [
  /^\/api\/events$/,                          // event tracking
  /^\/api\/setup$/,                           // eenmalige bootstrap
  /^\/api\/demo$/,                            // testshop config (publiek)
  /^\/api\/cart$/,                            // add-to-cart proxy
  /^\/api\/cron$/,                            // geplande imports (eigen auth via CRON_SECRET)
  /^\/api\/email-results$/,                  // mail mij de resultaten
  /^\/api\/trusted-shops$/,                  // Trusted Shops reviews proxy
  /^\/api\/flows\/[^/]+\/match$/,             // widget match
  /^\/api\/flows\/[^/]+$/,                    // widget flow lezen (GET only)
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Publieke API routes
  if (PUBLIC_API.some(re => re.test(pathname))) {
    // Flow GET is publiek, andere methoden (PUT/DELETE) niet
    if (pathname.match(/^\/api\/flows\/[^/]+$/) && req.method !== 'GET') {
      // Doorvallen naar auth-check
    } else {
      return NextResponse.next()
    }
  }

  const token = req.cookies.get('session')?.value
  const session = await decrypt(token)

  if (!session) {
    // API-aanroepen krijgen 401, pagina's worden doorgestuurd naar login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // Gebruikersbeheer is alleen voor keyuser
  if (
    (pathname.startsWith('/beheer/gebruikers') || pathname.startsWith('/api/users')) &&
    session.role !== 'keyuser'
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Onvoldoende rechten' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/beheer/flows', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.png$|.*\\.ico$).*)'],
}
