import { useState } from 'react'
import { Card, Tag, Tooltip, Switch } from 'antd'
import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons'
import type { DentalChartEntry } from '../../../../shared/types'
import ToothDetailPanel from './ToothDetailPanel'

interface Props {
  patientId: number
  entries: DentalChartEntry[]
  onEntryAdded: () => void
  readOnly?: boolean
}

// ── FDI tooth names ────────────────────────────────────────────────────────────
const FDI_NAMES: Record<number, { name: string; abbr: string }> = {
  11: { name: 'Upper Right Central Incisor', abbr: 'CI' },
  12: { name: 'Upper Right Lateral Incisor', abbr: 'LI' },
  13: { name: 'Upper Right Canine', abbr: 'C' },
  14: { name: 'Upper Right 1st Premolar', abbr: 'P1' },
  15: { name: 'Upper Right 2nd Premolar', abbr: 'P2' },
  16: { name: 'Upper Right 1st Molar', abbr: 'M1' },
  17: { name: 'Upper Right 2nd Molar', abbr: 'M2' },
  18: { name: 'Upper Right Wisdom Tooth', abbr: 'W' },
  21: { name: 'Upper Left Central Incisor', abbr: 'CI' },
  22: { name: 'Upper Left Lateral Incisor', abbr: 'LI' },
  23: { name: 'Upper Left Canine', abbr: 'C' },
  24: { name: 'Upper Left 1st Premolar', abbr: 'P1' },
  25: { name: 'Upper Left 2nd Premolar', abbr: 'P2' },
  26: { name: 'Upper Left 1st Molar', abbr: 'M1' },
  27: { name: 'Upper Left 2nd Molar', abbr: 'M2' },
  28: { name: 'Upper Left Wisdom Tooth', abbr: 'W' },
  31: { name: 'Lower Left Central Incisor', abbr: 'CI' },
  32: { name: 'Lower Left Lateral Incisor', abbr: 'LI' },
  33: { name: 'Lower Left Canine', abbr: 'C' },
  34: { name: 'Lower Left 1st Premolar', abbr: 'P1' },
  35: { name: 'Lower Left 2nd Premolar', abbr: 'P2' },
  36: { name: 'Lower Left 1st Molar', abbr: 'M1' },
  37: { name: 'Lower Left 2nd Molar', abbr: 'M2' },
  38: { name: 'Lower Left Wisdom Tooth', abbr: 'W' },
  41: { name: 'Lower Right Central Incisor', abbr: 'CI' },
  42: { name: 'Lower Right Lateral Incisor', abbr: 'LI' },
  43: { name: 'Lower Right Canine', abbr: 'C' },
  44: { name: 'Lower Right 1st Premolar', abbr: 'P1' },
  45: { name: 'Lower Right 2nd Premolar', abbr: 'P2' },
  46: { name: 'Lower Right 1st Molar', abbr: 'M1' },
  47: { name: 'Lower Right 2nd Molar', abbr: 'M2' },
  48: { name: 'Lower Right Wisdom Tooth', abbr: 'W' },
  51: { name: 'Upper Right Primary Central Incisor', abbr: 'CI' },
  52: { name: 'Upper Right Primary Lateral Incisor', abbr: 'LI' },
  53: { name: 'Upper Right Primary Canine', abbr: 'C' },
  54: { name: 'Upper Right Primary 1st Molar', abbr: 'M1' },
  55: { name: 'Upper Right Primary 2nd Molar', abbr: 'M2' },
  61: { name: 'Upper Left Primary Central Incisor', abbr: 'CI' },
  62: { name: 'Upper Left Primary Lateral Incisor', abbr: 'LI' },
  63: { name: 'Upper Left Primary Canine', abbr: 'C' },
  64: { name: 'Upper Left Primary 1st Molar', abbr: 'M1' },
  65: { name: 'Upper Left Primary 2nd Molar', abbr: 'M2' },
  71: { name: 'Lower Left Primary Central Incisor', abbr: 'CI' },
  72: { name: 'Lower Left Primary Lateral Incisor', abbr: 'LI' },
  73: { name: 'Lower Left Primary Canine', abbr: 'C' },
  74: { name: 'Lower Left Primary 1st Molar', abbr: 'M1' },
  75: { name: 'Lower Left Primary 2nd Molar', abbr: 'M2' },
  81: { name: 'Lower Right Primary Central Incisor', abbr: 'CI' },
  82: { name: 'Lower Right Primary Lateral Incisor', abbr: 'LI' },
  83: { name: 'Lower Right Primary Canine', abbr: 'C' },
  84: { name: 'Lower Right Primary 1st Molar', abbr: 'M1' },
  85: { name: 'Lower Right Primary 2nd Molar', abbr: 'M2' },
}

const PERMANENT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const PERMANENT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
const PRIMARY_UPPER   = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
const PRIMARY_LOWER   = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

// ── Procedure colour palette ───────────────────────────────────────────────────
const PROCEDURE_COLORS: Record<string, { fill: string; border: string; label: string }> = {
  Filling:      { fill: '#3b82f6', border: '#1d4ed8', label: 'Filling' },
  Extraction:   { fill: '#ef4444', border: '#b91c1c', label: 'Extraction' },
  Crown:        { fill: '#eab308', border: '#a16207', label: 'Crown / Bridge' },
  Bridge:       { fill: '#eab308', border: '#a16207', label: 'Crown / Bridge' },
  'Root Canal': { fill: '#f97316', border: '#c2410c', label: 'Root Canal' },
  RCT:          { fill: '#f97316', border: '#c2410c', label: 'Root Canal' },
  Implant:      { fill: '#8b5cf6', border: '#6d28d9', label: 'Implant' },
  Scaling:      { fill: '#06b6d4', border: '#0e7490', label: 'Scaling' },
  Healthy:      { fill: '#22c55e', border: '#15803d', label: 'Healthy' },
  Missing:      { fill: '#e2e8f0', border: '#94a3b8', label: 'Missing' },
  Other:        { fill: '#94a3b8', border: '#64748b', label: 'Other' },
}

function getProcedureCfg(type: string): { fill: string; border: string } {
  for (const [key, val] of Object.entries(PROCEDURE_COLORS)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return val
  }
  return { fill: '#94a3b8', border: '#64748b' }
}

function getToothColor(entries: DentalChartEntry[]): { crown: string; stroke: string } {
  if (!entries.length) return { crown: '#f8fafc', stroke: '#cbd5e1' }
  const top = entries[0]
  if (top.status === 'planned') return { crown: '#fed7aa', stroke: '#f97316' }
  if (top.status === 'ongoing') return { crown: '#fde68a', stroke: '#d97706' }
  const cfg = getProcedureCfg(top.procedure_type)
  return { crown: cfg.fill, stroke: cfg.border }
}

// ── Tooth type classifier ──────────────────────────────────────────────────────
type ToothType = 'central' | 'lateral' | 'canine' | 'premolar' | 'molar' | 'wisdom'

function getToothType(n: number): ToothType {
  const last = n % 10
  if (last === 1) return 'central'
  if (last === 2) return 'lateral'
  if (last === 3) return 'canine'
  if (last === 4 || last === 5) return 'premolar'
  if (last === 6 || last === 7) return 'molar'
  if (last === 8) return 'wisdom'
  return 'molar'
}

// ── Anatomical SVG tooth shapes (30×54 viewBox, crown at top, root at bottom) ──
// Crown spans y 0..28, root spans y 28..54
// Upper arch: shown as-is (roots pointing down, away from jaw)
// Lower arch: rotated 180° so roots point up, away from jaw
// W=30, crown H=26, root H=28

function ToothSVG({
  toothType,
  crownFill,
  crownStroke,
  isExtracted,
  isMissing,
  isUpper,
}: {
  toothType: ToothType
  crownFill: string
  crownStroke: string
  isExtracted: boolean
  isMissing: boolean
  isUpper: boolean
}) {
  const W = 30
  const totalH = 52
  // Crown shape definitions (top of crown at y=0, gumline at y=crownH)
  // Root shape definitions (starts at crownH, ends at totalH)

  function renderShape() {
    switch (toothType) {
      case 'central': {
        // Wide, flat crown; single root
        const crown = `M 4,26 C 4,24 4,18 5,12 C 6,6 8,2 15,1 C 22,2 24,6 25,12 C 26,18 26,24 26,26 Z`
        const root  = `M 4,26 C 5,32 6,38 8,44 C 10,50 13,52 15,52 C 17,52 20,50 22,44 C 24,38 25,32 26,26 Z`
        return <><path d={crown} fill={crownFill} stroke={crownStroke} strokeWidth="1" /><path d={root} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" /></>
      }
      case 'lateral': {
        // Slightly narrower than central
        const crown = `M 6,26 C 6,24 6,18 7,12 C 8,6 10,2 15,1 C 20,2 22,6 23,12 C 24,18 24,24 24,26 Z`
        const root  = `M 6,26 C 7,32 8,38 9,44 C 11,50 13,52 15,52 C 17,52 19,50 21,44 C 22,38 23,32 24,26 Z`
        return <><path d={crown} fill={crownFill} stroke={crownStroke} strokeWidth="1" /><path d={root} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" /></>
      }
      case 'canine': {
        // Pointed cusp, longer crown, single root
        const crown = `M 5,26 C 5,22 6,16 8,10 C 10,5 12,1 15,0 C 18,1 20,5 22,10 C 24,16 25,22 25,26 Z`
        const root  = `M 5,26 C 6,34 7,40 9,46 C 11,51 13,52 15,52 C 17,52 19,51 21,46 C 23,40 24,34 25,26 Z`
        return <><path d={crown} fill={crownFill} stroke={crownStroke} strokeWidth="1" /><path d={root} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" /></>
      }
      case 'premolar': {
        // Two cusps on top, narrower, bifurcated root hint
        const crown = `M 5,26 C 5,22 6,16 8,10 C 9,6 11,2 15,1 C 19,2 21,6 22,10 C 24,16 25,22 25,26 Z`
        // two small bumps at top
        const cusps = `M 10,8 C 10,4 12,2 15,2 C 18,2 20,4 20,8`
        const root1 = `M 5,26 C 6,33 7,40 9,46 C 10,50 12,52 14,52`
        const root2 = `M 25,26 C 24,33 23,40 21,46 C 20,50 18,52 16,52`
        return (
          <>
            <path d={crown} fill={crownFill} stroke={crownStroke} strokeWidth="1" />
            <path d={cusps} fill="none" stroke={crownStroke} strokeWidth="0.7" opacity="0.6" />
            <path d={root1} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" />
            <path d={root2} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" />
          </>
        )
      }
      case 'molar': {
        // Wide square crown, 3 roots
        const crown = `M 3,26 C 3,22 4,16 5,10 C 6,5 8,2 15,1 C 22,2 24,5 25,10 C 26,16 27,22 27,26 Z`
        // occlusal ridges
        const ridge1 = `M 8,14 L 8,20`
        const ridge2 = `M 15,12 L 15,22`
        const ridge3 = `M 22,14 L 22,20`
        // 3 roots
        const root1 = `M 3,26 C 3,33 4,40 5,46 C 6,50 8,52 10,52`
        const root2 = `M 13,26 C 13,33 13,40 13,46 C 13,50 14,52 15,52`
        const root3 = `M 27,26 C 27,33 26,40 25,46 C 24,50 22,52 20,52`
        return (
          <>
            <path d={crown} fill={crownFill} stroke={crownStroke} strokeWidth="1" />
            <line x1="8" y1="14" x2="8" y2="20" stroke={crownStroke} strokeWidth="0.6" opacity="0.5" />
            <line x1="15" y1="12" x2="15" y2="22" stroke={crownStroke} strokeWidth="0.6" opacity="0.5" />
            <line x1="22" y1="14" x2="22" y2="20" stroke={crownStroke} strokeWidth="0.6" opacity="0.5" />
            <path d={root1} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" />
            <path d={root2} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" />
            <path d={root3} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" />
          </>
        )
      }
      case 'wisdom': {
        // Similar to molar but slightly smaller / more irregular
        const crown = `M 4,26 C 4,22 5,16 6,11 C 7,6 9,2 15,1 C 21,2 23,6 24,11 C 25,16 26,22 26,26 Z`
        const root1 = `M 4,26 C 4,34 5,41 7,47 C 8,50 10,52 12,52`
        const root2 = `M 26,26 C 26,34 25,41 23,47 C 22,50 20,52 18,52`
        return (
          <>
            <path d={crown} fill={crownFill} stroke={crownStroke} strokeWidth="1" />
            <path d={root1} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" />
            <path d={root2} fill="none" stroke={crownStroke} strokeWidth="0.8" opacity="0.5" />
          </>
        )
      }
    }
  }

  // The SVG coordinate system: crown at y=0, root at y=52
  // For upper teeth: we want roots pointing away from the arch (downward in display)  → no flip
  // For lower teeth: we want roots pointing away from the arch (upward in display)     → flip vertically
  const transform = isUpper
    ? undefined
    : `scale(1,-1) translate(0,-${totalH})`

  return (
    <svg
      width={W} height={totalH}
      viewBox={`0 0 ${W} ${totalH}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <g transform={transform}>
        {isMissing ? (
          // Gray outline only for missing tooth
          <path
            d={`M 4,26 C 4,24 4,18 5,12 C 6,6 8,2 15,1 C 22,2 24,6 25,12 C 26,18 26,24 26,26 Z`}
            fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2"
          />
        ) : (
          <>
            {renderShape()}
            {isExtracted && (
              <>
                <line x1="6" y1="6" x2="24" y2="22" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <line x1="24" y1="6" x2="6" y2="22" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </>
        )}
      </g>
    </svg>
  )
}

// ── Single tooth cell ──────────────────────────────────────────────────────────
function ToothCell({
  number, entries, onClick, isSelected, isUpper
}: {
  number: number
  entries: DentalChartEntry[]
  onClick: () => void
  isSelected: boolean
  isUpper: boolean
}) {
  const info = FDI_NAMES[number] ?? { name: `Tooth ${number}`, abbr: '?' }
  const hasPending  = entries.some(e => e.status === 'planned' || e.status === 'ongoing')
  const hasDone     = entries.some(e => e.status === 'completed')
  const isExtracted = entries.some(e => e.procedure_type.toLowerCase().includes('extraction'))
  const isMissing   = entries.some(e => e.procedure_type.toLowerCase().includes('missing'))
  const { crown, stroke } = getToothColor(entries)
  const type = getToothType(number)

  const tooltipContent = (
    <div style={{ fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{info.name}</div>
      <div style={{ opacity: 0.8 }}>FDI #{number}</div>
      {entries.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {entries.map(e => `${e.procedure_type} (${e.status})`).join(', ')}
        </div>
      )}
    </div>
  )

  return (
    <Tooltip title={tooltipContent} placement={isUpper ? 'bottom' : 'top'}>
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          flexDirection: isUpper ? 'column' : 'column-reverse',
          alignItems: 'center',
          width: 36,
          cursor: 'pointer',
          userSelect: 'none',
          padding: '2px 3px',
          borderRadius: 6,
          background: isSelected ? '#eff6ff' : 'transparent',
          border: isSelected ? '1.5px solid #2563eb' : '1.5px solid transparent',
          transition: 'all 0.15s',
          position: 'relative',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(37,99,235,0.06)' }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
      >
        {/* FDI number */}
        <div style={{
          fontSize: 9, fontWeight: 700,
          color: isSelected ? '#2563eb' : '#64748b',
          lineHeight: 1,
          marginBottom: isUpper ? 2 : 0,
          marginTop: isUpper ? 0 : 2,
        }}>
          {number}
        </div>

        {/* Anatomical tooth */}
        <div style={{ position: 'relative' }}>
          <ToothSVG
            toothType={type}
            crownFill={crown}
            crownStroke={stroke}
            isExtracted={isExtracted}
            isMissing={isMissing}
            isUpper={isUpper}
          />
          {/* Status badge */}
          {(hasPending || hasDone) && (
            <div style={{
              position: 'absolute',
              top: isUpper ? -4 : 'auto',
              bottom: isUpper ? 'auto' : -4,
              right: -4,
              fontSize: 10, lineHeight: 1
            }}>
              {hasDone && !hasPending
                ? <CheckCircleFilled style={{ color: '#22c55e', background: '#fff', borderRadius: '50%' }} />
                : <ExclamationCircleFilled style={{ color: '#f97316', background: '#fff', borderRadius: '50%' }} />
              }
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  )
}

// ── Main dental chart ──────────────────────────────────────────────────────────
export default function DentalChart({ patientId, entries, onEntryAdded, readOnly }: Props) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [showPrimary, setShowPrimary] = useState(false)

  function getToothEntries(n: number): DentalChartEntry[] {
    return entries.filter(e => e.tooth_number === String(n))
  }

  const upper = showPrimary ? PRIMARY_UPPER : PERMANENT_UPPER
  const lower = showPrimary ? PRIMARY_LOWER : PERMANENT_LOWER
  const upperRight = upper.slice(0, upper.length / 2)
  const upperLeft  = upper.slice(upper.length / 2)
  const lowerRight = lower.slice(0, lower.length / 2)
  const lowerLeft  = lower.slice(lower.length / 2)

  const pendingCount   = entries.filter(e => e.status === 'planned' || e.status === 'ongoing').length
  const completedCount = entries.filter(e => e.status === 'completed').length

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Card
          size="small"
          styles={{ header: { padding: '0 16px' }, body: { padding: '16px' } }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Dental Chart</span>
                <Tag color="blue" style={{ fontSize: 10.5, borderRadius: 20 }}>FDI Notation</Tag>
                {pendingCount > 0 && <Tag color="orange" style={{ fontSize: 10.5, borderRadius: 20 }}>{pendingCount} pending</Tag>}
                {completedCount > 0 && <Tag color="green" style={{ fontSize: 10.5, borderRadius: 20 }}>{completedCount} completed</Tag>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Pediatric</span>
                <Switch size="small" checked={showPrimary} onChange={setShowPrimary} />
              </div>
            </div>
          }
        >
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 600 }}>

              {/* ── UPPER ARCH ── */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ flex: 1, textAlign: 'right', paddingRight: 10, fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Upper Right (Q1)
                </div>
                <div style={{ width: 20, flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: 'left', paddingLeft: 10, fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Upper Left (Q2)
                </div>
              </div>

              {/* Upper row — crown at top, roots hanging down */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingBottom: 4 }}>
                <div style={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flex: 1 }}>
                  {upperRight.map(n => (
                    <ToothCell key={n} number={n} entries={getToothEntries(n)}
                      onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
                      isSelected={selectedTooth === n} isUpper={true} />
                  ))}
                </div>
                {/* Midline */}
                <div style={{ width: 2, height: 60, background: '#cbd5e1', borderRadius: 1, margin: '0 3px', flexShrink: 0, alignSelf: 'center' }} />
                <div style={{ display: 'flex', gap: 1, justifyContent: 'flex-start', flex: 1 }}>
                  {upperLeft.map(n => (
                    <ToothCell key={n} number={n} entries={getToothEntries(n)}
                      onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
                      isSelected={selectedTooth === n} isUpper={true} />
                  ))}
                </div>
              </div>

              {/* Occlusal divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '6px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <div style={{ margin: '0 12px', fontSize: 9.5, color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.08em' }}>
                  MAXILLARY ↑ · ↓ MANDIBULAR
                </div>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>

              {/* ── LOWER ARCH ── */}
              {/* Lower row — crown at bottom (flipped), roots pointing up */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingTop: 4 }}>
                <div style={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flex: 1 }}>
                  {lowerRight.map(n => (
                    <ToothCell key={n} number={n} entries={getToothEntries(n)}
                      onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
                      isSelected={selectedTooth === n} isUpper={false} />
                  ))}
                </div>
                <div style={{ width: 2, height: 60, background: '#cbd5e1', borderRadius: 1, margin: '0 3px', flexShrink: 0, alignSelf: 'center' }} />
                <div style={{ display: 'flex', gap: 1, justifyContent: 'flex-start', flex: 1 }}>
                  {lowerLeft.map(n => (
                    <ToothCell key={n} number={n} entries={getToothEntries(n)}
                      onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
                      isSelected={selectedTooth === n} isUpper={false} />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                <div style={{ flex: 1, textAlign: 'right', paddingRight: 10, fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Lower Right (Q4)
                </div>
                <div style={{ width: 20, flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: 'left', paddingLeft: 10, fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Lower Left (Q3)
                </div>
              </div>
            </div>
          </div>

          {/* Status legend */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ExclamationCircleFilled style={{ color: '#f97316', fontSize: 13 }} />
              <span style={{ fontSize: 11.5, color: '#64748b' }}>Pending / In Progress</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleFilled style={{ color: '#22c55e', fontSize: 13 }} />
              <span style={{ fontSize: 11.5, color: '#64748b' }}>Completed</span>
            </div>
          </div>

          {/* Procedure colour legend */}
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Array.from(new Map(Object.values(PROCEDURE_COLORS).map(c => [c.label, c])).values()).map(cfg => (
              <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: cfg.fill, border: `1px solid ${cfg.border}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#64748b' }}>{cfg.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#fed7aa', border: '1px solid #f97316', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#64748b' }}>Planned</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tooth detail panel */}
      {selectedTooth && (
        <div style={{ width: 340, flexShrink: 0 }}>
          <ToothDetailPanel
            toothNumber={selectedTooth}
            toothName={FDI_NAMES[selectedTooth]?.name}
            patientId={patientId}
            entries={getToothEntries(selectedTooth)}
            onClose={() => setSelectedTooth(null)}
            onEntryAdded={onEntryAdded}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  )
}
