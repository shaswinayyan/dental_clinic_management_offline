import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Select, Input, DatePicker, Spin, message, Tooltip } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { TreatmentRecord, Treatment, Chair, IpcResult } from '../../../../../shared/types'
import type { Route } from '../../../components/Layout/MainLayout'
import { useAuthStore } from '../../../store/authStore'
import { useTheme } from '../../../context/ThemeContext'
import dayjs from 'dayjs'

interface Props { patientId: number; navigate: (r: Route) => void }

// ── Area mode classification ───────────────────────────────────────────────────
type AreaMode = 'tooth' | 'arch' | 'scope'

function getAreaMode(t: Treatment | null): AreaMode {
  if (!t) return 'tooth'
  const name = t.name.toLowerCase()
  const cat = t.category

  // Preventive (scaling, prophylaxis, fluoride, sealant) → scope
  if (cat === 'Preventive') return 'scope'

  // Periodontal (deep cleaning, curettage, root planing) → scope
  if (cat === 'Periodontal') return 'scope'

  // Orthodontic (braces, aligners, retainers) → arch
  if (cat === 'Orthodontic') return 'arch'

  // Prosthodontic: dentures/complete prosthesis → arch, else → tooth
  if (cat === 'Prosthodontic') {
    if (
      name.includes('denture') ||
      name.includes('complete prosth') ||
      name.includes('full prosth') ||
      name.includes('obturator')
    ) return 'arch'
    return 'tooth'
  }

  // Cosmetic: whitening/bleaching/polishing → scope, veneers/bonding → tooth
  if (cat === 'Cosmetic') {
    if (
      name.includes('whiten') ||
      name.includes('bleach') ||
      name.includes('polish') ||
      name.includes('clean')
    ) return 'scope'
    return 'tooth'
  }

  // Restorative, Endodontic, Surgical, Other → specific tooth
  return 'tooth'
}

// ── FDI layout ─────────────────────────────────────────────────────────────────
// Upper: Q1 right→left (18→11), gap, Q2 left→right (21→28)
// Lower: Q4 right→left (48→41), gap, Q3 left→right (31→38)
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]

const TOOTH_NAMES: Record<number, string> = {
  11:'UR Central',12:'UR Lateral',13:'UR Canine',14:'UR 1st Premolar',15:'UR 2nd Premolar',16:'UR 1st Molar',17:'UR 2nd Molar',18:'UR Wisdom',
  21:'UL Central',22:'UL Lateral',23:'UL Canine',24:'UL 1st Premolar',25:'UL 2nd Premolar',26:'UL 1st Molar',27:'UL 2nd Molar',28:'UL Wisdom',
  31:'LL Central',32:'LL Lateral',33:'LL Canine',34:'LL 1st Premolar',35:'LL 2nd Premolar',36:'LL 1st Molar',37:'LL 2nd Molar',38:'LL Wisdom',
  41:'LR Central',42:'LR Lateral',43:'LR Canine',44:'LR 1st Premolar',45:'LR 2nd Premolar',46:'LR 1st Molar',47:'LR 2nd Molar',48:'LR Wisdom',
}

// ── Single tooth button ────────────────────────────────────────────────────────
function ToothBtn({ n, active, onClick }: { n: number; active: boolean; onClick: () => void }) {
  return (
    <Tooltip title={`${n} — ${TOOTH_NAMES[n] || `Tooth ${n}`}`} placement="top" mouseEnterDelay={0.4}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: 26, height: 26, borderRadius: 5, border: 'none', padding: 0,
          background: active ? '#c9a84c' : 'var(--zd-border-sub)',
          color: active ? '#0a1628' : 'var(--zd-text-2)',
          fontSize: 8.5, fontWeight: 700,
          cursor: 'pointer', flexShrink: 0,
          outline: active ? '2px solid rgba(201,168,76,0.5)' : 'none',
          outlineOffset: 1,
          transition: 'background 0.12s, outline 0.12s',
          boxShadow: active ? '0 1px 4px rgba(201,168,76,0.35)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(201,168,76,0.15)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'var(--zd-border-sub)' }}
      >
        {n}
      </button>
    </Tooltip>
  )
}

// ── TOOTH PICKER ──────────────────────────────────────────────────────────────
// Used for: Restorative, Endodontic, Surgical, Prosthodontic (crowns/bridges/implants)
function ToothPicker({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const { isDark } = useTheme()
  const selected = new Set<string>(
    (value || '').split(',').map(s => s.trim()).filter(s => /^\d{2}$/.test(s))
  )

  function toggle(n: number) {
    const next = new Set(selected)
    const k = String(n)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    onChange?.(Array.from(next).sort((a,b) => Number(a)-Number(b)).join(', '))
  }

  function clearAll() { onChange?.('') }

  const Row = ({ teeth, label }: { teeth: number[]; label: string }) => (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {teeth.map(n => (
        <ToothBtn key={n} n={n} active={selected.has(String(n))} onClick={() => toggle(n)} />
      ))}
    </div>
  )

  return (
    <div>
      <div style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 10,
        border: isDark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid #e2e8f0', padding: '10px 12px'
      }}>
        {/* Upper arch row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, width: 28, textAlign: 'right', paddingRight: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Q1</div>
          <Row teeth={UPPER_RIGHT} label="Q1" />
          <div style={{ width: 10, borderLeft: '1.5px dashed #cbd5e1', height: 20, margin: '0 4px' }} />
          <Row teeth={UPPER_LEFT} label="Q2" />
          <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, width: 28, textAlign: 'left', paddingLeft: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Q2</div>
        </div>

        {/* Jaw divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '7px 0' }}>
          <div style={{ flex: 1, height: 1.5, background: 'linear-gradient(to right, transparent, #cbd5e1)' }} />
          <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>jaw line</span>
          <div style={{ flex: 1, height: 1.5, background: 'linear-gradient(to left, transparent, #cbd5e1)' }} />
        </div>

        {/* Lower arch row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, width: 28, textAlign: 'right', paddingRight: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Q4</div>
          <Row teeth={LOWER_RIGHT} label="Q4" />
          <div style={{ width: 10, borderLeft: '1.5px dashed #cbd5e1', height: 20, margin: '0 4px' }} />
          <Row teeth={LOWER_LEFT} label="Q3" />
          <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, width: 28, textAlign: 'left', paddingLeft: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Q3</div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#94a3b8' }}>
          <span>← Patient's right</span>
          <span>Patient's left →</span>
        </div>
      </div>

      {/* Selected summary */}
      {selected.size > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Selected teeth:</span>
          {Array.from(selected).sort((a,b) => Number(a)-Number(b)).map(tn => (
            <Tag
              key={tn}
              color="blue"
              closable
              onClose={() => toggle(Number(tn))}
              style={{ margin: 0, borderRadius: 12, fontSize: 11 }}
            >
              {tn} — {TOOTH_NAMES[Number(tn)] || `Tooth ${tn}`}
            </Tag>
          ))}
          <button
            type="button"
            onClick={clearAll}
            style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, padding: '0 4px' }}
          >
            Clear all
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
          Click on a tooth to select it. Hold Ctrl or click multiple for multi-tooth procedures.
        </div>
      )}
    </div>
  )
}

// ── ARCH PICKER ───────────────────────────────────────────────────────────────
// Used for: Orthodontic, Prosthodontic dentures
const ARCH_OPTIONS = [
  {
    value: 'Upper Jaw',
    label: 'Upper Jaw',
    sub: 'Maxillary arch',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.4)',
    svg: (
      <svg width="48" height="28" viewBox="0 0 48 28" fill="none">
        <path d="M4 24 C4 12 10 4 24 3 C38 4 44 12 44 24" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <circle cx="8"  cy="22" r="2.5" fill="#3b82f6" opacity="0.7"/>
        <circle cx="14" cy="14" r="2.5" fill="#3b82f6" opacity="0.7"/>
        <circle cx="22" cy="9"  r="2.5" fill="#3b82f6" opacity="0.7"/>
        <circle cx="26" cy="9"  r="2.5" fill="#3b82f6" opacity="0.7"/>
        <circle cx="34" cy="14" r="2.5" fill="#3b82f6" opacity="0.7"/>
        <circle cx="40" cy="22" r="2.5" fill="#3b82f6" opacity="0.7"/>
      </svg>
    )
  },
  {
    value: 'Lower Jaw',
    label: 'Lower Jaw',
    sub: 'Mandibular arch',
    color: '#0891b2',
    bg: 'rgba(8,145,178,0.15)',
    border: 'rgba(8,145,178,0.4)',
    svg: (
      <svg width="48" height="28" viewBox="0 0 48 28" fill="none">
        <path d="M4 4 C4 16 10 24 24 25 C38 24 44 16 44 4" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <circle cx="8"  cy="6"  r="2.5" fill="#0891b2" opacity="0.7"/>
        <circle cx="14" cy="14" r="2.5" fill="#0891b2" opacity="0.7"/>
        <circle cx="22" cy="19" r="2.5" fill="#0891b2" opacity="0.7"/>
        <circle cx="26" cy="19" r="2.5" fill="#0891b2" opacity="0.7"/>
        <circle cx="34" cy="14" r="2.5" fill="#0891b2" opacity="0.7"/>
        <circle cx="40" cy="6"  r="2.5" fill="#0891b2" opacity="0.7"/>
      </svg>
    )
  },
  {
    value: 'Both Jaws',
    label: 'Both Jaws',
    sub: 'Full arch',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#c4b5fd',
    svg: (
      <svg width="48" height="32" viewBox="0 0 48 32" fill="none">
        <path d="M4 26 C4 18 10 12 24 11 C38 12 44 18 44 26" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <path d="M4 6 C4 14 10 20 24 21 C38 20 44 14 44 6" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <line x1="24" y1="11" x2="24" y2="21" stroke="#7c3aed" strokeWidth="1" strokeDasharray="2,2"/>
      </svg>
    )
  }
]

function ArchPicker({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const { isDark } = useTheme()
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {ARCH_OPTIONS.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(active ? '' : opt.value)}
            style={{
              flex: 1, padding: '14px 10px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${active ? opt.border : 'var(--zd-border)'}`,
              background: active ? opt.bg : isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
              color: active ? opt.color : 'var(--zd-text-2)',
              textAlign: 'center', transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
            }}
          >
            {opt.svg}
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: active ? opt.color : 'var(--zd-text-3)' }}>{opt.sub}</div>
            {active && (
              <div style={{
                fontSize: 10, background: opt.color, color: '#fff',
                borderRadius: 999, padding: '1px 8px', marginTop: 2
              }}>✓ Selected</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── SCOPE PICKER ──────────────────────────────────────────────────────────────
// Used for: Preventive, Periodontal, Cosmetic whitening
type ScopeOption = { value: string; label: string; sub?: string; group: 'full' | 'quadrant' | 'arch' }

const SCOPE_OPTIONS: ScopeOption[] = [
  { value: 'Full Mouth',      label: 'Full Mouth',    group: 'full'     },
  { value: 'Upper Arch',      label: 'Upper Arch',    group: 'arch'     },
  { value: 'Lower Arch',      label: 'Lower Arch',    group: 'arch'     },
  { value: 'Q1 - Upper Right', label: 'Q1',  sub: 'Upper Right', group: 'quadrant' },
  { value: 'Q2 - Upper Left',  label: 'Q2',  sub: 'Upper Left',  group: 'quadrant' },
  { value: 'Q3 - Lower Left',  label: 'Q3',  sub: 'Lower Left',  group: 'quadrant' },
  { value: 'Q4 - Lower Right', label: 'Q4',  sub: 'Lower Right', group: 'quadrant' },
]

// quadrant layout SVGs (mini)
const SCOPE_ICONS: Record<string, React.ReactNode> = {
  'Full Mouth':       <svg width="30" height="22" viewBox="0 0 30 22"><path d="M2 14 C2 6 7 2 15 2 C23 2 28 6 28 14" stroke="#c9a84c" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M2 8 C2 16 7 20 15 20 C23 20 28 16 28 8" stroke="#c9a84c" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>,
  'Upper Arch':       <svg width="30" height="16" viewBox="0 0 30 16"><path d="M2 14 C2 6 7 2 15 2 C23 2 28 6 28 14" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>,
  'Lower Arch':       <svg width="30" height="16" viewBox="0 0 30 16"><path d="M2 2 C2 10 7 14 15 14 C23 14 28 10 28 2" stroke="#0891b2" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>,
  'Q1 - Upper Right': <svg width="22" height="16" viewBox="0 0 22 16"><path d="M12 14 C12 6 16 2 22 2" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="0" y="0" width="11" height="14" rx="2" fill="#f59e0b" opacity="0.15"/><text x="5.5" y="10" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b45309">Q1</text></svg>,
  'Q2 - Upper Left':  <svg width="22" height="16" viewBox="0 0 22 16"><path d="M10 14 C10 6 6 2 0 2" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="11" y="0" width="11" height="14" rx="2" fill="#f59e0b" opacity="0.15"/><text x="16.5" y="10" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b45309">Q2</text></svg>,
  'Q3 - Lower Left':  <svg width="22" height="16" viewBox="0 0 22 16"><path d="M10 2 C10 10 6 14 0 14" stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="11" y="2" width="11" height="14" rx="2" fill="#10b981" opacity="0.15"/><text x="16.5" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="#065f46">Q3</text></svg>,
  'Q4 - Lower Right': <svg width="22" height="16" viewBox="0 0 22 16"><path d="M12 2 C12 10 16 14 22 14" stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="0" y="2" width="11" height="14" rx="2" fill="#10b981" opacity="0.15"/><text x="5.5" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="#065f46">Q4</text></svg>,
}

function ScopePicker({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const { isDark } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Full mouth row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {SCOPE_OPTIONS.filter(o => o.group === 'full' || o.group === 'arch').map(opt => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange?.(active ? '' : opt.value)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${active ? '#c9a84c' : 'var(--zd-border)'}`,
                background: active ? 'rgba(201,168,76,0.12)' : isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                color: active ? '#c9a84c' : 'var(--zd-text-2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                transition: 'all 0.15s'
              }}
            >
              {SCOPE_ICONS[opt.value]}
              <div style={{ fontWeight: 700, fontSize: 12 }}>{opt.label}</div>
            </button>
          )
        })}
      </div>

      {/* Quadrant row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {SCOPE_OPTIONS.filter(o => o.group === 'quadrant').map(opt => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange?.(active ? '' : opt.value)}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${active ? '#c9a84c' : 'var(--zd-border)'}`,
                background: active ? 'rgba(201,168,76,0.12)' : isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                color: active ? '#c9a84c' : 'var(--zd-text-2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'all 0.15s'
              }}
            >
              {SCOPE_ICONS[opt.value]}
              <div style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
              {opt.sub && <div style={{ fontSize: 9, color: active ? '#c9a84c' : 'var(--zd-text-3)' }}>{opt.sub}</div>}
            </button>
          )
        })}
      </div>

      {value && (
        <div style={{
          fontSize: 12, color: '#c9a84c', fontWeight: 600,
          background: 'rgba(201,168,76,0.1)', padding: '4px 10px', borderRadius: 6,
          border: '1px solid rgba(201,168,76,0.3)'
        }}>
          ✓ Area: {value}
        </div>
      )}
    </div>
  )
}

// ── AREA SELECTOR (dispatcher) ────────────────────────────────────────────────
interface AreaSelectorProps { value?: string; onChange?: (v: string) => void; treatment: Treatment | null }

function AreaSelector({ value, onChange, treatment }: AreaSelectorProps) {
  const mode = getAreaMode(treatment)
  if (mode === 'arch')  return <ArchPicker  value={value} onChange={onChange} />
  if (mode === 'scope') return <ScopePicker value={value} onChange={onChange} />
  return                       <ToothPicker value={value} onChange={onChange} />
}

// ── Area mode label & hint ─────────────────────────────────────────────────────
function AreaLabel({ mode, name }: { mode: AreaMode; name: string }) {
  const configs: Record<AreaMode, { label: string; hint: string; color: string }> = {
    tooth: {
      label: 'Tooth / Teeth',
      hint: 'Select specific tooth/teeth from the FDI chart below',
      color: '#c9a84c'
    },
    arch: {
      label: 'Jaw / Arch',
      hint: 'Select the jaw being treated',
      color: '#7c3aed'
    },
    scope: {
      label: 'Treatment Scope',
      hint: 'Select full mouth or specific quadrant(s)',
      color: '#0891b2'
    }
  }
  const cfg = configs[mode]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: 8
    }}>
      <div>
        <span style={{ fontWeight: 600, color: 'var(--zd-text-1)', fontSize: 13 }}>{cfg.label}</span>
        <div style={{ fontSize: 11, color: 'var(--zd-text-3)', marginTop: 1 }}>{cfg.hint}</div>
      </div>
      <span style={{
        fontSize: 10, background: cfg.color, color: '#fff',
        borderRadius: 999, padding: '2px 8px', fontWeight: 700, flexShrink: 0, marginTop: 2
      }}>
        {mode.toUpperCase()}
      </span>
    </div>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function TreatmentsTab({ patientId }: Props) {
  const [records, setRecords] = useState<TreatmentRecord[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [chairs, setChairs] = useState<Chair[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null)
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  const { isDark } = useTheme()

  async function load() {
    setLoading(true)
    const [r, tr, cr] = await Promise.all([
      window.api.patients.listTreatments(patientId) as Promise<IpcResult<TreatmentRecord[]>>,
      window.api.appointments.listTreatments() as Promise<IpcResult<Treatment[]>>,
      window.api.appointments.listChairs() as Promise<IpcResult<Chair[]>>
    ])
    if (r.success && r.data) setRecords(r.data)
    if (tr.success && tr.data) setTreatments(tr.data)
    if (cr.success && cr.data) setChairs(cr.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  function handleTreatmentChange(treatmentId: number) {
    const t = treatments.find(x => x.id === treatmentId) ?? null
    setSelectedTreatment(t)
    // Reset area when treatment changes — mode may differ
    form.setFieldValue('tooth_area', '')
  }

  function closeForm() {
    setShowForm(false)
    setSelectedTreatment(null)
    form.resetFields()
  }

  async function handleAdd(values: {
    treatment_id: number
    tooth_area?: string
    chair_id?: number
    status: string
    notes?: string
    treated_at: dayjs.Dayjs
  }) {
    if (!user) return
    setSaving(true)
    try {
      const r = await window.api.patients.addTreatmentRecord({
        patient_id: patientId,
        treatment_id: values.treatment_id,
        tooth_area: values.tooth_area || undefined,
        chair_id: values.chair_id,
        status: values.status,
        notes: values.notes,
        treated_at: values.treated_at?.toISOString() ?? new Date().toISOString(),
        created_by: user.id
      }) as IpcResult
      if (r.success) {
        message.success('Treatment recorded — dental chart updated automatically')
        closeForm()
        load()
      } else {
        message.error(r.error)
      }
    } finally {
      setSaving(false)
    }
  }

  const areaMode = getAreaMode(selectedTreatment)

  // Group treatments by category for better Select UX
  const treatmentOptions = (() => {
    const groups: Record<string, Treatment[]> = {}
    treatments.forEach(t => {
      if (!groups[t.category]) groups[t.category] = []
      groups[t.category].push(t)
    })
    return Object.entries(groups).map(([cat, items]) => ({
      label: cat,
      options: items.filter(t => t.is_active).map(t => ({ value: t.id, label: t.name }))
    }))
  })()

  const STATUS_COLOR: Record<string, string> = { completed: 'green', ongoing: 'orange', planned: 'default' }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'treated_at',
      width: 110,
      render: (v: string) => dayjs(v).format('DD MMM YYYY')
    },
    {
      title: 'Procedure',
      dataIndex: 'treatment_name',
      ellipsis: true
    },
    {
      title: 'Tooth / Area',
      dataIndex: 'tooth_area',
      width: 150,
      render: (v: string) => v ? (
        <Tag style={{ borderRadius: 10, fontSize: 11 }}>{v}</Tag>
      ) : (
        <span style={{ color: '#94a3b8' }}>—</span>
      )
    },
    {
      title: 'Chair',
      dataIndex: 'chair_name',
      width: 100,
      render: (v: string) => v || '—'
    },
    {
      title: 'Doctor',
      dataIndex: 'doctor_name',
      width: 110,
      render: (v: string) => v || '—'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#94a3b8' }}>—</span>
    }
  ]

  if (loading) return <Spin />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {user?.role === 'doctor' && (
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setShowForm(true)}>
            Add Treatment
          </Button>
        )}
      </div>

      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: 'No treatments recorded yet' }}
      />

      <Modal
        open={showForm}
        title="Record Treatment / Procedure"
        footer={null}
        onCancel={closeForm}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          {/* Procedure selector — grouped by category */}
          <Form.Item name="treatment_id" label="Procedure" rules={[{ required: true, message: 'Select a procedure' }]}>
            <Select
              showSearch
              placeholder="Search or select a procedure..."
              onChange={handleTreatmentChange}
              options={treatmentOptions}
              optionFilterProp="label"
              style={{ width: '100%' }}
            />
          </Form.Item>

          {/* Area selector — only shown after a treatment is picked */}
          {selectedTreatment ? (
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 10, padding: '12px 14px',
              border: isDark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid #e2e8f0', marginBottom: 16
            }}>
              <AreaLabel mode={areaMode} name={selectedTreatment.name} />
              <Form.Item name="tooth_area" style={{ marginBottom: 0 }}>
                <AreaSelector treatment={selectedTreatment} />
              </Form.Item>
            </div>
          ) : (
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 10, padding: '14px 16px',
              border: isDark ? '1.5px dashed rgba(255,255,255,0.1)' : '1.5px dashed #e2e8f0', marginBottom: 16,
              textAlign: 'center', color: 'var(--zd-text-3)', fontSize: 13
            }}>
              Select a procedure above to see the appropriate tooth/area selector
            </div>
          )}

          <Form.Item name="chair_id" label="Chair">
            <Select
              placeholder="Select chair (optional)"
              options={chairs.map(c => ({ value: c.id, label: c.name }))}
              allowClear
            />
          </Form.Item>

          <Form.Item name="status" label="Status" initialValue="completed">
            <Select
              options={[
                { value: 'completed', label: '✓ Completed' },
                { value: 'ongoing',   label: '⟳ Ongoing / In Progress' },
                { value: 'planned',   label: '◷ Planned / Upcoming' }
              ]}
            />
          </Form.Item>

          <Form.Item name="treated_at" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="notes" label="Clinical Notes">
            <Input.TextArea rows={3} placeholder="Observations, materials used, follow-up instructions..." />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={closeForm}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Save Treatment
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
