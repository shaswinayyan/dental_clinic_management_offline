interface Props {
  iconSize?: number
  showText?: boolean
  textSize?: number
  collapsed?: boolean
}

/** Inline SVG logo mark — no external image needed */
function VorsaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8d080" />
          <stop offset="50%" stopColor="#c9a84c" />
          <stop offset="100%" stopColor="#8a6820" />
        </linearGradient>
        <linearGradient id="vg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dde4ee" />
          <stop offset="100%" stopColor="#a8b8cc" />
        </linearGradient>
      </defs>

      {/* Orbital ellipse ring */}
      <ellipse
        cx="24" cy="30" rx="20" ry="12"
        stroke="url(#vg1)" strokeWidth="1.4" fill="none" opacity="0.7"
        transform="rotate(-28 24 30)"
      />

      {/* Tooth silhouette */}
      <path
        d="M25 6C21 6 17.5 8.5 16 12C14 10 11 9.5 9.5 11.5C7.5 14 8 17.5 9.5 20.5C11 23.5 11 26.5 11.5 30C12 33.5 14 37 16 37C17.5 37 18 35.5 18.5 33C19 30.5 19.5 29 21.5 29C23.5 29 24 30.5 24.5 33C25 35.5 25.5 37 28 37C30.5 37 32.5 33.5 33 30C33.5 26.5 33.5 23.5 35 20.5C36.5 17.5 37 14 35 11.5C33.5 9.5 30.5 10 29 12C27.5 8.5 25.5 6 25 6Z"
        fill="rgba(201,168,76,0.13)"
        stroke="url(#vg2)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Network nodes */}
      <circle cx="21" cy="18" r="1.8" fill="url(#vg1)" />
      <circle cx="27" cy="16" r="1.8" fill="url(#vg1)" />
      <circle cx="29" cy="23" r="1.8" fill="url(#vg1)" />
      <circle cx="22" cy="25" r="1.8" fill="url(#vg1)" />
      <circle cx="17" cy="23" r="1.4" fill="url(#vg1)" opacity="0.8" />

      {/* Network lines */}
      <line x1="21" y1="18" x2="27" y2="16" stroke="#c9a84c" strokeWidth="0.9" opacity="0.65" />
      <line x1="27" y1="16" x2="29" y2="23" stroke="#c9a84c" strokeWidth="0.9" opacity="0.65" />
      <line x1="29" y1="23" x2="22" y2="25" stroke="#c9a84c" strokeWidth="0.9" opacity="0.65" />
      <line x1="22" y1="25" x2="17" y2="23" stroke="#c9a84c" strokeWidth="0.9" opacity="0.65" />
      <line x1="17" y1="23" x2="21" y2="18" stroke="#c9a84c" strokeWidth="0.9" opacity="0.65" />
      <line x1="21" y1="18" x2="22" y2="25" stroke="#c9a84c" strokeWidth="0.9" opacity="0.45" />

      {/* Arrow shaft */}
      <line x1="44" y1="6" x2="27" y2="22" stroke="url(#vg1)" strokeWidth="2.2" strokeLinecap="round" />

      {/* Arrow head */}
      <path d="M36 4L46 4L46 14Z" fill="url(#vg1)" />
    </svg>
  )
}

export default function VorsaLogo({ iconSize = 38, showText = true, collapsed = false }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 11, flexShrink: 0 }}>
      <VorsaIcon size={iconSize} />
      {showText && !collapsed && (
        <div style={{ lineHeight: 1.15 }}>
          <div style={{
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: '0.12em',
            background: 'linear-gradient(135deg, #e8d080 0%, #c9a84c 50%, #a07828 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textTransform: 'uppercase'
          }}>
            VORSA
          </div>
          <div style={{
            fontSize: 7.5,
            letterSpacing: '0.22em',
            color: '#7a8da8',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginTop: 1
          }}>
            DENTAL CLINIC MANAGEMENT
          </div>
        </div>
      )}
    </div>
  )
}
