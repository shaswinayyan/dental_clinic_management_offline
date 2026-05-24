import { useEffect, useState, useCallback } from 'react'
import { Button, DatePicker, Tag, Tooltip, Modal, Space, message, Spin, Avatar, InputNumber, Form } from 'antd'
import {
  LeftOutlined, RightOutlined, PlusOutlined, ReloadOutlined,
  ClockCircleOutlined, UserOutlined, CalendarOutlined, CheckCircleOutlined,
  PhoneOutlined, SwapOutlined
} from '@ant-design/icons'
import type { Appointment, Chair, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'
import AppointmentForm from './AppointmentForm'
import { useT } from '../../hooks/useT'
import dayjs from 'dayjs'

interface Props { navigate: (r: Route) => void }

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  scheduled:   { bg: 'rgba(59,130,246,0.14)',  border: 'rgba(59,130,246,0.35)',  text: '#3b82f6', dot: '#60a5fa',  label: 'Registered' },
  confirmed:   { bg: 'rgba(34,197,94,0.14)',   border: 'rgba(34,197,94,0.35)',   text: '#16a34a', dot: '#22c55e',  label: 'Confirmed' },
  pending:     { bg: 'rgba(234,88,12,0.14)',   border: 'rgba(234,88,12,0.35)',   text: '#ea580c', dot: '#fb923c',  label: 'In Treatment' },
  completed:   { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.28)',   text: '#15803d', dot: '#22c55e',  label: 'Finished' },
  cancelled:   { bg: 'rgba(220,38,38,0.12)',   border: 'rgba(220,38,38,0.3)',    text: '#dc2626', dot: '#ef4444',  label: 'Cancelled' },
  rescheduled: { bg: 'rgba(139,92,246,0.13)',  border: 'rgba(139,92,246,0.3)',   text: '#7c3aed', dot: '#8b5cf6',  label: 'Rescheduled' },
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8am–8pm
const SLOT_HEIGHT = 68

export default function AppointmentScheduler({ navigate }: Props) {
  const [date, setDate]               = useState(dayjs())
  const [chairs, setChairs]           = useState<Chair[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ chairId: number; time: string } | null>(null)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleForm] = Form.useForm()
  const [rescheduling, setRescheduling] = useState(false)
  const t = useT()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [chairRes, apptRes] = await Promise.all([
      window.api.appointments.listChairs() as Promise<IpcResult<Chair[]>>,
      window.api.appointments.list({ date: date.format('YYYY-MM-DD') }) as Promise<IpcResult<Appointment[]>>
    ])
    if (chairRes.success && chairRes.data) setChairs(chairRes.data)
    if (apptRes.success && apptRes.data) setAppointments(apptRes.data)
    setLoading(false)
  }, [date])

  useEffect(() => { loadData() }, [loadData])

  function handleSlotClick(chairId: number, hour: number) {
    setSelectedSlot({ chairId, time: date.hour(hour).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss') })
    setShowForm(true)
  }

  async function handleStatusChange(apptId: number, status: string) {
    const r = await window.api.appointments.updateStatus(apptId, status) as IpcResult
    if (r.success) { loadData(); setSelectedAppt(null) }
    else message.error(r.error)
  }

  async function handleReschedule(values: { new_date: dayjs.Dayjs; new_duration: number }) {
    if (!selectedAppt) return
    setRescheduling(true)
    try {
      const r = await window.api.appointments.reschedule(
        selectedAppt.id,
        values.new_date.format('YYYY-MM-DDTHH:mm:ss'),
        values.new_duration
      ) as IpcResult<number>
      if (r.success) {
        message.success('Appointment rescheduled successfully')
        setShowReschedule(false)
        setSelectedAppt(null)
        rescheduleForm.resetFields()
        loadData()
      } else {
        message.error(r.error || 'Failed to reschedule appointment')
      }
    } finally {
      setRescheduling(false)
    }
  }

  function getAppointmentsForChair(chairId: number) {
    return appointments.filter(a => a.chair_id === chairId && !['cancelled', 'rescheduled'].includes(a.status))
  }

  function getApptTop(appt: Appointment): number {
    const tt = dayjs(appt.scheduled_at)
    return (tt.hour() + tt.minute() / 60 - 8) * SLOT_HEIGHT
  }

  function getApptHeight(appt: Appointment): number {
    return Math.max((appt.duration_minutes / 60) * SLOT_HEIGHT, 36)
  }

  const todayCount = appointments.length

  return (
    <div>
      {/* Header bar */}
      <div style={{
        background: t.bg, borderRadius: 12, border: `1px solid ${t.border}`,
        padding: '12px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarOutlined style={{ color: '#c9a84c' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{todayCount}</span>
            <span style={{ color: t.textSub, fontSize: 13 }}>total appointments</span>
          </div>
          <div style={{ width: 1, height: 20, background: t.border }} />
          <Space>
            <Button size="small" icon={<LeftOutlined />} onClick={() => setDate(d => d.subtract(1, 'day'))} />
            <Button size="small" type="primary" onClick={() => setDate(dayjs())}>Today</Button>
            <DatePicker
              value={date} onChange={d => d && setDate(d)}
              format="ddd, DD MMM YYYY" style={{ width: 190 }}
              size="small"
            />
            <Button size="small" icon={<RightOutlined />} onClick={() => setDate(d => d.add(1, 'day'))} />
          </Space>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} size="small" />
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { setSelectedSlot(null); setShowForm(true) }}>
            New Appointment
          </Button>
        </Space>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot }} />
            <span style={{ fontSize: 12, color: t.textSub }}>{v.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, background: t.bg, borderRadius: 12 }}>
          <Spin size="large" />
        </div>
      ) : (
        <div style={{ background: t.bg, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', minWidth: Math.max(700, chairs.length * 220 + 64) }}>
              {/* Time gutter */}
              <div style={{ width: 64, flexShrink: 0, borderRight: `1px solid ${t.border}` }}>
                <div style={{ height: 56, borderBottom: `1px solid ${t.border}`, background: t.bgFill }} />
                {HOURS.map(h => (
                  <div key={h} style={{
                    height: SLOT_HEIGHT, borderBottom: `1px solid ${t.border}`,
                    display: 'flex', alignItems: 'flex-start', paddingTop: 6, paddingLeft: 10,
                    fontSize: 11, color: t.textHint, fontWeight: 600
                  }}>
                    {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                  </div>
                ))}
              </div>

              {/* Chair columns */}
              {chairs.map((chair, ci) => (
                <div key={chair.id} style={{ flex: 1, borderRight: ci < chairs.length - 1 ? `1px solid ${t.border}` : 'none', minWidth: 200 }}>
                  <div style={{
                    height: 56, borderBottom: `1px solid ${t.border}`,
                    background: t.bgFill, padding: '0 16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center'
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: t.text }}>{chair.name}</div>
                    <div style={{ fontSize: 11, color: t.textHint }}>
                      {getAppointmentsForChair(chair.id).length} patient(s) today
                    </div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    {HOURS.map(h => (
                      <div key={h}
                        style={{ height: SLOT_HEIGHT, borderBottom: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                        onClick={() => handleSlotClick(chair.id, h)}
                        onMouseEnter={e => (e.currentTarget.style.background = t.bgFill)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      />
                    ))}

                    {getAppointmentsForChair(chair.id).map(appt => {
                      const top = getApptTop(appt)
                      const height = getApptHeight(appt)
                      if (top < 0 || top >= HOURS.length * SLOT_HEIGHT) return null
                      const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled
                      return (
                        <Tooltip key={appt.id}
                          title={
                            <div>
                              <div>{appt.patient_name} — {appt.treatment_name || 'No treatment'}</div>
                              {appt.patient_contact_number && (
                                <div style={{ marginTop: 2, opacity: 0.85 }}>
                                  📞 {appt.patient_contact_number}
                                </div>
                              )}
                            </div>
                          }
                        >
                          <div
                            onClick={e => { e.stopPropagation(); setSelectedAppt(appt) }}
                            style={{
                              position: 'absolute', left: 6, right: 6, top,
                              height, borderRadius: 8, padding: '5px 10px',
                              cursor: 'pointer', background: cfg.bg,
                              border: `1px solid ${cfg.border}`,
                              overflow: 'hidden', zIndex: 2,
                              transition: 'opacity 0.15s'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: cfg.text }}>{cfg.label}</span>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: cfg.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {appt.patient_name}
                            </div>
                            {height > 50 && appt.patient_contact_number && (
                              <div style={{ fontSize: 10.5, color: cfg.text, opacity: 0.75, display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                                <PhoneOutlined style={{ fontSize: 9 }} />
                                {appt.patient_contact_number}
                              </div>
                            )}
                            {height > 66 && (
                              <div style={{ fontSize: 11, color: cfg.text, opacity: 0.75, display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                                <ClockCircleOutlined style={{ fontSize: 9 }} />
                                {dayjs(appt.scheduled_at).format('HH:mm')} › {dayjs(appt.scheduled_at).add(appt.duration_minutes, 'minute').format('HH:mm')}
                              </div>
                            )}
                            {height > 84 && appt.treatment_name && (
                              <div style={{ fontSize: 10.5, color: cfg.text, opacity: 0.6, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {appt.treatment_name}
                              </div>
                            )}
                          </div>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Appointment detail modal */}
      <Modal
        open={!!selectedAppt}
        title={null}
        onCancel={() => setSelectedAppt(null)}
        footer={null}
        width={480}
      >
        {selectedAppt && (() => {
          const cfg = STATUS_CONFIG[selectedAppt.status] ?? STATUS_CONFIG.scheduled
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Avatar size={48} style={{ background: cfg.bg, color: cfg.text, fontSize: 18, fontWeight: 700 }}>
                  {selectedAppt.patient_name?.charAt(0) ?? 'P'}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: t.text }}>{selectedAppt.patient_name}</div>
                  <Tag color={cfg.dot} style={{ borderRadius: 20, marginTop: 2 }}>{cfg.label}</Tag>
                </div>
              </div>

              <div style={{ background: t.bgFill, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                {[
                  { icon: <UserOutlined />, label: 'Treatment', value: selectedAppt.treatment_name || '—' },
                  { icon: <CalendarOutlined />, label: 'Chair', value: selectedAppt.chair_name },
                  { icon: <ClockCircleOutlined />, label: 'Time', value: `${dayjs(selectedAppt.scheduled_at).format('DD MMM YYYY, HH:mm')} (${selectedAppt.duration_minutes} min)` },
                  ...(selectedAppt.patient_contact_number ? [{
                    icon: <PhoneOutlined />, label: 'Phone', value: selectedAppt.patient_contact_number
                  }] : [])
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: i < arr.length - 1 ? 10 : 0 }}>
                    <span style={{ color: t.textHint, width: 18, flexShrink: 0 }}>{row.icon}</span>
                    <span style={{ color: t.textSub, fontSize: 12.5, width: 80, flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontWeight: 500, color: t.text, fontSize: 13 }}>{row.value}</span>
                  </div>
                ))}
                {selectedAppt.notes && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}`, fontSize: 12.5, color: t.textSub }}>
                    {selectedAppt.notes}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedAppt.status === 'scheduled' && (
                  <Button type="primary" size="small" icon={<CheckCircleOutlined />}
                    onClick={() => handleStatusChange(selectedAppt.id, 'confirmed')}>Confirm</Button>
                )}
                {['scheduled', 'confirmed', 'pending'].includes(selectedAppt.status) && (
                  <Button size="small" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
                    onClick={() => handleStatusChange(selectedAppt.id, 'completed')}>Mark Finished</Button>
                )}
                {['scheduled', 'confirmed'].includes(selectedAppt.status) && (
                  <Button size="small" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }}
                    onClick={() => handleStatusChange(selectedAppt.id, 'pending')}>In Treatment</Button>
                )}
                {['scheduled', 'confirmed', 'pending'].includes(selectedAppt.status) && (
                  <Button size="small" icon={<SwapOutlined />}
                    onClick={() => {
                      rescheduleForm.setFieldsValue({
                        new_date: dayjs(selectedAppt.scheduled_at),
                        new_duration: selectedAppt.duration_minutes
                      })
                      setShowReschedule(true)
                    }}>
                    Reschedule
                  </Button>
                )}
                {['scheduled', 'confirmed', 'pending'].includes(selectedAppt.status) && (
                  <Button danger size="small" onClick={() => handleStatusChange(selectedAppt.id, 'cancelled')}>Cancel</Button>
                )}
                <Button size="small"
                  onClick={() => { setSelectedAppt(null); navigate({ page: 'invoice-create', patientId: selectedAppt.patient_id, appointmentId: selectedAppt.id }) }}>
                  Create Invoice
                </Button>
                <Button size="small" type="link"
                  onClick={() => { setSelectedAppt(null); navigate({ page: 'patient-detail', id: selectedAppt.patient_id }) }}>
                  Patient Record →
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Reschedule modal */}
      <Modal
        open={showReschedule}
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SwapOutlined style={{ color: '#7c3aed' }} /> Reschedule Appointment</span>}
        onCancel={() => { setShowReschedule(false); rescheduleForm.resetFields() }}
        footer={null}
        width={420}
        destroyOnClose
      >
        {selectedAppt && (
          <div>
            <div style={{ background: t.bgFill, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: t.textSub }}>
              <strong style={{ color: t.text }}>{selectedAppt.patient_name}</strong>
              {' — currently '}{dayjs(selectedAppt.scheduled_at).format('DD MMM YYYY, HH:mm')}
            </div>
            <Form form={rescheduleForm} layout="vertical" onFinish={handleReschedule}>
              <Form.Item name="new_date" label="New Date & Time" rules={[{ required: true, message: 'Please select new date and time' }]}>
                <DatePicker
                  showTime={{ format: 'HH:mm', minuteStep: 15 }}
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: '100%' }}
                  disabledDate={d => d.isBefore(dayjs().startOf('day'))}
                />
              </Form.Item>
              <Form.Item name="new_duration" label="Duration (minutes)" rules={[{ required: true }]}>
                <InputNumber min={5} max={480} step={15} style={{ width: '100%' }} />
              </Form.Item>
              <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: '#d97706' }}>
                The original appointment will be marked as rescheduled and a new one will be created.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => { setShowReschedule(false); rescheduleForm.resetFields() }}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={rescheduling} icon={<SwapOutlined />}>
                  Confirm Reschedule
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal>

      {/* Create appointment modal */}
      <Modal
        open={showForm} title="Schedule Appointment"
        footer={null} width={580} destroyOnClose
        onCancel={() => { setShowForm(false); setSelectedSlot(null) }}
      >
        <AppointmentForm
          defaultChairId={selectedSlot?.chairId}
          defaultDateTime={selectedSlot?.time}
          onSuccess={() => { setShowForm(false); setSelectedSlot(null); loadData() }}
          onCancel={() => { setShowForm(false); setSelectedSlot(null) }}
        />
      </Modal>
    </div>
  )
}
