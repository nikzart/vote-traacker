import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone: string | null): string {
  if (!phone) return ''
  // Remove non-digits
  const digits = phone.replace(/\D/g, '')
  // Format as Indian phone number
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return phone
}

export function getPoliticalLeaningColor(leaning: string | null): string {
  switch (leaning) {
    case 'UDF':
      return 'bg-green-500'
    case 'LDF':
      return 'bg-red-500'
    case 'NDA':
      return 'bg-orange-500'
    case 'Other':
      return 'bg-purple-500'
    case 'Neutral':
      return 'bg-gray-500'
    default:
      return 'bg-gray-300'
  }
}

export function getPoliticalLeaningBadgeClasses(leaning: string | null): string {
  switch (leaning) {
    case 'UDF':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'LDF':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'NDA':
      return 'bg-orange-100 text-orange-800 border-orange-300'
    case 'Other':
      return 'bg-purple-100 text-purple-800 border-purple-300'
    case 'Neutral':
      return 'bg-gray-100 text-gray-800 border-gray-300'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-300'
  }
}

export function generateRandomPassword(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100 * 10) / 10
}
