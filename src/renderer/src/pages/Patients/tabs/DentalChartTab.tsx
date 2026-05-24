import { useEffect, useState } from 'react'
import { Spin, Card, Tag, Empty } from 'antd'
import type { DentalChartEntry, TreatmentRecord, IpcResult } from '../../../../../shared/types'
import { useAuthStore } from '../../../store/authStore'
import { useT } from '../../../hooks/useT'
import DentalChart from '../../../components/DentalChart/DentalChart'
import dayjs from 'dayjs'

interface Props { patientId: number }

// ── Detect if a tooth_area is arch/scope-level (not a specific FDI tooth number) ──
function isScopeArea(area?: string): boolean {
  if (!area) return false
  // If it contains any FDI 2-digit number (like 11, 21, 36), it's tooth-specific
  if (/\b[1-8][1-8]\b/.test(area)) return false
  return true
}

// ── Scope area → visual badge config ──────────────────────────────────────────
function getAreaTag(area: string): { label: string; color: string } {
  const a = area.toLowerCase()
  if (a.includes('full mouth'))    return { label: area, color: 'blue' }
  if (a.includes('upper'))         return { label: area, color: 'geekblue' }
  if (a.includes('lower'))         return { label: area, color: 'cyan' }
  if (a.includes('q1'))            return { label: area, color: 'gold' }
  if (a.includes('q2'))            return { label: area, color: 'orange' }
  if (a.includes('q3'))            return { label: area, color: 'green' }
  if (a.includes('q4'))            return { label: area, color: 'lime' }
  return { label: area, color: 'default' }
}

const STATUS_COLOR: Record<string, string> = { completed: 'green', ongoing: 'orange', planned: 'default' }

export default function DentalChartTab({ patientId }: Props) {
  const [entries, setEntries] = useState<DentalChartEntry[]>([])
  const [scopeTreatments, setScopeTreatments] = useState<TreatmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()
  const t = useT()

  async function load() {
    setLoading(true)
    const [chartRes, treatRes] = await Promise.all([
      window.api.patients.getDentalChart(patientId) as Promise<IpcResult<DentalChartEntry[]>>,
      window.api.patients.listTreatments(patientId) as Promise<IpcResult<TreatmentRecord[]>>
    ])
    if (chartRes.success && chartRes.data) setEntries(chartRes.data)
    if (treatRes.success && treatRes.data) {
      // Keep only scope/arch-level treatments
      setScopeTreatments(treatRes.data.filter(r => isScopeArea(r.tooth_area)))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  if (loading) return <Spin />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tooth-level chart */}
      <DentalChart
        patientId={patientId}
        entries={entries}
        onEntryAdded={load}
        readOnly={user?.role !== 'doctor'}
      />

      {/* Arch / Scope level treatment summary */}
      <Card
        size="small"
        title={
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            Arch &amp; Scope-Level Treatments
            <Tag style={{ marginLeft: 8, fontSize: 10, borderRadius: 20 }}>{scopeTreatments.length}</Tag>
          </span>
        }
      >
        {scopeTreatments.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: '#94a3b8', fontSize: 12 }}>
                No full-mouth, arch, or quadrant treatments recorded.
                These appear here when you record Preventive, Periodontal, Orthodontic, or Cosmetic procedures.
              </span>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scopeTreatments.map(rec => {
              const areaTag = rec.tooth_area ? getAreaTag(rec.tooth_area) : null
              return (
                <div
                  key={rec.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: t.bgFill, border: `1px solid ${t.border}`,
                    flexWrap: 'wrap'
                  }}
                >
                  {/* Date */}
                  <span style={{ fontSize: 11, color: t.textHint, minWidth: 80, flexShrink: 0 }}>
                    {dayjs(rec.treated_at).format('DD MMM YYYY')}
                  </span>

                  {/* Procedure name */}
                  <span style={{ fontWeight: 600, fontSize: 13, color: t.text, flex: 1, minWidth: 120 }}>
                    {rec.treatment_name}
                  </span>

                  {/* Area badge */}
                  {areaTag && (
                    <Tag color={areaTag.color} style={{ borderRadius: 10, fontSize: 11 }}>
                      {areaTag.label}
                    </Tag>
                  )}

                  {/* Status badge */}
                  <Tag color={STATUS_COLOR[rec.status]} style={{ borderRadius: 10, fontSize: 11 }}>
                    {rec.status}
                  </Tag>

                  {/* Doctor */}
                  {rec.doctor_name && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>Dr. {rec.doctor_name}</span>
                  )}

                  {/* Notes */}
                  {rec.notes && (
                    <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                      — {rec.notes}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
