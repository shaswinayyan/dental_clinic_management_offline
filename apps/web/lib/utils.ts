import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as currency */
export function formatCurrency(
  amount: number | string,
  symbol = '$',
  decimals = 2,
): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(n)) return `${symbol}0.00`
  return `${symbol}${n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/** Format a Date or ISO string to locale date string */
export function formatDate(date: Date | string, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Format a Date or ISO string to locale time string */
export function formatTime(date: Date | string, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/** Truncate text to maxLength with ellipsis */
export function truncate(text: string, maxLength = 50): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

/** Get initials from a name (up to 2 chars) */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

/** Appointment status colour mapping */
export const APPT_STATUS_COLOURS: Record<string, string> = {
  scheduled:  'bg-blue-100  text-blue-700',
  confirmed:  'bg-purple-100 text-purple-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100   text-red-700',
  no_show:    'bg-amber-100  text-amber-700',
}
