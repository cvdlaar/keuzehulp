'use client'
import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

function Illustration() {
  return (
    <svg viewBox="0 0 560 640" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <radialGradient id="bg" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </radialGradient>
        <filter id="blur1">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="blur2">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      {/* Achtergrond */}
      <rect width="560" height="640" fill="url(#bg)" />

      {/* Zachte gloeiballen */}
      <ellipse cx="140" cy="180" rx="180" ry="180" fill="url(#glow1)" filter="url(#blur1)" />
      <ellipse cx="420" cy="460" rx="140" ry="140" fill="url(#glow2)" filter="url(#blur1)" />

      {/* Subtiel rasterpatroon */}
      {Array.from({ length: 12 }).map((_, r) =>
        Array.from({ length: 10 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={c * 56 + 28} cy={r * 56 + 28} r="1.2" fill="white" fillOpacity="0.07" />
        ))
      )}

      {/* ── Flow-diagram ── */}

      {/* Verbindingslijnen */}
      {/* Startvraag → Antw A */}
      <line x1="200" y1="148" x2="120" y2="256" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 4" />
      {/* Startvraag → Antw B */}
      <line x1="220" y1="152" x2="280" y2="256" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 4" />
      {/* Startvraag → Antw C */}
      <line x1="236" y1="148" x2="420" y2="256" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 4" />

      {/* Antw A → Vraag 2 */}
      <line x1="120" y1="296" x2="120" y2="376" stroke="#93c5fd" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 4" />
      {/* Antw B → Vraag 2 */}
      <line x1="260" y1="292" x2="170" y2="376" stroke="#93c5fd" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 4" />
      {/* Antw C → Vraag 3 */}
      <line x1="420" y1="296" x2="380" y2="376" stroke="#93c5fd" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 4" />

      {/* Vraag 2 → Resultaten */}
      <line x1="145" y1="416" x2="200" y2="496" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Vraag 3 → Resultaten */}
      <line x1="380" y1="416" x2="330" y2="496" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.5" />

      {/* ── Nodes ── */}

      {/* Startvraag (groot) */}
      <rect x="164" y="104" width="96" height="48" rx="12" fill="#1e40af" stroke="#60a5fa" strokeWidth="1.5" />
      <text x="212" y="124" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui" opacity="0.6">Vraag 1</text>
      <text x="212" y="139" textAnchor="middle" fill="white" fontSize="10.5" fontFamily="system-ui" fontWeight="600">Wat zoek je?</text>

      {/* Antwoord A */}
      <rect x="74" y="256" width="92" height="40" rx="10" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1.2" />
      <text x="120" y="271" textAnchor="middle" fill="#bfdbfe" fontSize="8.5" fontFamily="system-ui">Antwoord A</text>
      <text x="120" y="285" textAnchor="middle" fill="white" fontSize="10" fontFamily="system-ui" fontWeight="600">Compact</text>

      {/* Antwoord B */}
      <rect x="224" y="256" width="92" height="40" rx="10" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1.2" />
      <text x="270" y="271" textAnchor="middle" fill="#bfdbfe" fontSize="8.5" fontFamily="system-ui">Antwoord B</text>
      <text x="270" y="285" textAnchor="middle" fill="white" fontSize="10" fontFamily="system-ui" fontWeight="600">Standaard</text>

      {/* Antwoord C */}
      <rect x="374" y="256" width="92" height="40" rx="10" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1.2" />
      <text x="420" y="271" textAnchor="middle" fill="#bfdbfe" fontSize="8.5" fontFamily="system-ui">Antwoord C</text>
      <text x="420" y="285" textAnchor="middle" fill="white" fontSize="10" fontFamily="system-ui" fontWeight="600">Uitgebreid</text>

      {/* Vraag 2 */}
      <rect x="74" y="376" width="112" height="40" rx="10" fill="#1e40af" stroke="#60a5fa" strokeWidth="1.2" />
      <text x="130" y="391" textAnchor="middle" fill="#bfdbfe" fontSize="8.5" fontFamily="system-ui">Vraag 2</text>
      <text x="130" y="406" textAnchor="middle" fill="white" fontSize="10" fontFamily="system-ui" fontWeight="600">Welk merk?</text>

      {/* Vraag 3 */}
      <rect x="334" y="376" width="112" height="40" rx="10" fill="#1e40af" stroke="#60a5fa" strokeWidth="1.2" />
      <text x="390" y="391" textAnchor="middle" fill="#bfdbfe" fontSize="8.5" fontFamily="system-ui">Vraag 3</text>
      <text x="390" y="406" textAnchor="middle" fill="white" fontSize="10" fontFamily="system-ui" fontWeight="600">Wat is je budget?</text>

      {/* Resultaten (glow + groen) */}
      <ellipse cx="265" cy="490" rx="90" ry="26" fill="#14532d" fillOpacity="0.4" filter="url(#blur2)" />
      <rect x="185" y="496" width="160" height="52" rx="14" fill="#166534" stroke="#4ade80" strokeWidth="1.5" />
      <text x="265" y="517" textAnchor="middle" fill="#86efac" fontSize="9" fontFamily="system-ui">Jouw resultaten</text>
      <text x="265" y="534" textAnchor="middle" fill="white" fontSize="11.5" fontFamily="system-ui" fontWeight="700">★ Beste match</text>

      {/* Pijltjes op verbindingslijnen */}
      <polygon points="200,497 195,488 205,488" fill="#4ade80" opacity="0.7" />
      <polygon points="330,497 325,488 335,488" fill="#4ade80" opacity="0.7" />

      {/* Label onderaan */}
      <text x="280" y="610" textAnchor="middle" fill="white" fillOpacity="0.2" fontSize="11" fontFamily="system-ui" letterSpacing="3">KEUZEHULP</text>
    </svg>
  )
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div className="h-screen overflow-hidden flex">
      {/* Illustratie — verborgen op mobiel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        <Illustration />
        <div className="absolute inset-0 flex flex-col justify-end p-12 pointer-events-none">
          <p className="text-white text-3xl font-bold leading-snug mb-2">
            De slimste weg<br />naar het juiste product.
          </p>
          <p className="text-blue-200 text-sm">Beheer al je configurators</p>
        </div>
      </div>

      {/* Formulier */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Keuzehulp</p>
            <h1 className="text-2xl font-bold text-gray-900">Inloggen</h1>
          </div>

          <form action={action} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">E-mailadres</label>
              <input
                id="email" name="email" type="text" required autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Wachtwoord</label>
              <input
                id="password" name="password" type="password" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit" disabled={pending}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
            >
              {pending ? 'Inloggen…' : 'Inloggen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
