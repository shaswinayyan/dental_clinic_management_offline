interface Props {
  iconSize?: number
  showText?: boolean
  collapsed?: boolean
}

function VorsaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Gold gradient — main accent */}
        <linearGradient id="vGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#f2dc7e" />
          <stop offset="45%"  stopColor="#c9a84c" />
          <stop offset="100%" stopColor="#8a6018" />
        </linearGradient>
        {/* Silver gradient — tooth body */}
        <linearGradient id="vSilver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#dde5f0" />
          <stop offset="60%"  stopColor="#b8c8dc" />
          <stop offset="100%" stopColor="#8898b0" />
        </linearGradient>
        {/* Tooth fill — subtle gold-tinted white */}
        <linearGradient id="vToothFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="rgba(201,168,76,0.08)" />
          <stop offset="100%" stopColor="rgba(201,168,76,0.03)" />
        </linearGradient>
        {/* Arrow gold */}
        <linearGradient id="vArrow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#f2dc7e" />
          <stop offset="100%" stopColor="#c9a84c" />
        </linearGradient>
      </defs>

      {/* ── Tooth body ──────────────────────────────────────────── */}
      {/*  Distinctive dental shape: two upper cusps, wide middle, M-root bottom */}
      <path
        d="M38 10
           C34 10 30.5 12.5 29 16
           C27 14 24 13.5 22.5 15
           C20.5 17.5 21 21.5 22.5 25
           C24 28.5 24 32 24.5 36.5
           C25 41 27 45 29 45
           C30.5 45 31 43 31.5 40.5
           C32 38 32.5 36.5 34.5 36.5
           C36.5 36.5 37 38 37.5 40.5
           C38 43 38.5 45 40.5 45
           C42.5 45 44.5 41 45 36.5
           C45.5 32 45.5 28.5 47 25
           C48.5 21.5 49 17.5 47 15
           C45.5 13.5 42.5 14 41 16
           C39.5 12.5 38.5 10 38 10 Z"
        fill="url(#vToothFill)"
        stroke="url(#vSilver)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* ── Network nodes & lines inside tooth ───────────────────── */}
      {/* Lines first (behind nodes) */}
      <line x1="32" y1="23" x2="37" y2="21" stroke="#c9a84c" strokeWidth="1.1" opacity="0.75" />
      <line x1="32" y1="23" x2="28" y2="28" stroke="#c9a84c" strokeWidth="1.1" opacity="0.75" />
      <line x1="32" y1="23" x2="37" y2="29" stroke="#c9a84c" strokeWidth="1.1" opacity="0.75" />
      <line x1="37" y1="21" x2="42" y2="26" stroke="#b8c8dc" strokeWidth="1"   opacity="0.6"  />
      <line x1="28" y1="28" x2="37" y2="29" stroke="#c9a84c" strokeWidth="1.1" opacity="0.65" />
      <line x1="37" y1="29" x2="42" y2="26" stroke="#b8c8dc" strokeWidth="1"   opacity="0.6"  />

      {/* Nodes */}
      <circle cx="32" cy="23" r="2.4" fill="url(#vGold)" />       {/* hub */}
      <circle cx="37" cy="21" r="1.9" fill="#d4b860" opacity="0.9" />
      <circle cx="28" cy="28" r="1.9" fill="url(#vGold)" />
      <circle cx="37" cy="29" r="1.9" fill="#b8c4d8" opacity="0.85" />
      <circle cx="42" cy="26" r="1.7" fill="#b8c4d8" opacity="0.8" />

      {/* ── Orbital ring — the tilted elliptical swoosh ───────────── */}
      {/* Main gold orbital arc: from lower-right, sweeps left and up, exits upper-right */}
      <path
        d="M 48 40
           C 54 34 56 22 50 14
           C 44 7  32 6  24 12
           C 16 18 15 30 20 38"
        stroke="url(#vGold)"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Secondary silver arc (inner, slightly offset) */}
      <path
        d="M 46 43
           C 50 38 51 28 46 20
           C 43 15 37 13 33 14"
        stroke="url(#vSilver)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity="0.65"
      />

      {/* ── Arrow — emerges from orbital ring at upper-right ─────── */}
      {/* Arrow shaft */}
      <line
        x1="50" y1="14"
        x2="66" y2="5"
        stroke="url(#vArrow)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Arrow head — solid triangle */}
      <path
        d="M 58 4 L 72 3 L 68 16 Z"
        fill="url(#vArrow)"
      />
    </svg>
  )
}

export default function VorsaLogo({ iconSize = 38, showText = true, collapsed = false }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10, flexShrink: 0 }}>
      <VorsaIcon size={iconSize} />
      {showText && !collapsed && (
        <div style={{ lineHeight: 1.2 }}>
          {/* VORSA wordmark */}
          <div style={{
            fontFamily: "'Segoe UI', 'Arial Black', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: iconSize * 0.55,
            letterSpacing: '0.10em',
            background: 'linear-gradient(135deg, #f2dc7e 0%, #c9a84c 45%, #a07828 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textTransform: 'uppercase',
            lineHeight: 1
          }}>
            VORSA
          </div>
          {/* Tagline */}
          <div style={{
            fontSize: iconSize * 0.155,
            letterSpacing: '0.20em',
            color: '#6a7e98',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginTop: 3,
            whiteSpace: 'nowrap'
          }}>
            DENTAL CLINIC MANAGEMENT
          </div>
        </div>
      )}
    </div>
  )
}
