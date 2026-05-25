'use client'

import { useParams }  from 'next/navigation'
import { useQuery }   from '@tanstack/react-query'
import { useApi }     from '@/lib/api'
import { formatDate, getInitials } from '@/lib/utils'
import Link           from 'next/link'
import { ArrowLeft, AlertTriangle, Pill, Grid3x3 } from 'lucide-react'

interface Patient {
  id:             string
  name:           string
  email?:         string
  phone?:         string
  date_of_birth?: string
  gender?:        string
  address?:       string
  blood_group?:   string
  created_at:     string
}

interface Allergy    { id: string; name: string; severity?: string }
interface Medication { id: string; name: string; dosage?: string; frequency?: string; is_active: boolean }

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-text-muted" />
        <h2 className="font-medium text-text-primary text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const api    = useApi()

  const { data: patientRes, isLoading } = useQuery<{ success: boolean; data: Patient }>({
    queryKey: ['patient', id],
    queryFn:  () => api.get(`/patients/${id}`),
  })

  const { data: allergiesRes }   = useQuery<{ success: boolean; data: Allergy[] }>({
    queryKey: ['patient', id, 'allergies'],
    queryFn:  () => api.get(`/patients/${id}/allergies`),
    enabled:  !!id,
  })

  const { data: medsRes }        = useQuery<{ success: boolean; data: Medication[] }>({
    queryKey: ['patient', id, 'medications'],
    queryFn:  () => api.get(`/patients/${id}/medications`),
    enabled:  !!id,
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-surface-muted rounded animate-pulse" />
        <div className="h-32 bg-surface-muted rounded-xl animate-pulse" />
      </div>
    )
  }

  const patient    = patientRes?.data
  const allergies  = allergiesRes?.data ?? []
  const meds       = medsRes?.data ?? []

  if (!patient) return <div className="p-6 text-text-muted">Patient not found.</div>

  return (
    <div className="p-6 space-y-5">
      {/* Back */}
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to patients
      </Link>

      {/* Patient header */}
      <div className="bg-white rounded-xl border border-border p-5 flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xl font-semibold shrink-0">
          {getInitials(patient.name)}
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-text-muted">Full Name</p>
            <p className="font-medium text-text-primary mt-0.5">{patient.name}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Phone</p>
            <p className="font-medium text-text-primary mt-0.5">{patient.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Date of Birth</p>
            <p className="font-medium text-text-primary mt-0.5">
              {patient.date_of_birth ? formatDate(patient.date_of_birth) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Blood Group</p>
            <p className="font-medium text-text-primary mt-0.5">{patient.blood_group ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Allergies */}
        <Section title="Allergies" icon={AlertTriangle}>
          {allergies.length === 0
            ? <p className="text-sm text-text-muted">No known allergies</p>
            : (
              <div className="space-y-2">
                {allergies.map(a => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">{a.name}</span>
                    {a.severity && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                        {a.severity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </Section>

        {/* Medications */}
        <Section title="Current Medications" icon={Pill}>
          {meds.filter(m => m.is_active).length === 0
            ? <p className="text-sm text-text-muted">No current medications</p>
            : (
              <div className="space-y-2">
                {meds.filter(m => m.is_active).map(m => (
                  <div key={m.id}>
                    <p className="text-sm font-medium text-text-primary">{m.name}</p>
                    {(m.dosage || m.frequency) && (
                      <p className="text-xs text-text-muted">
                        {[m.dosage, m.frequency].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </Section>
      </div>

      {/* Dental Chart placeholder */}
      <Section title="Dental Chart" icon={Grid3x3}>
        <div className="flex items-center justify-center py-8 text-text-muted text-sm">
          Interactive dental chart coming soon
        </div>
      </Section>
    </div>
  )
}
