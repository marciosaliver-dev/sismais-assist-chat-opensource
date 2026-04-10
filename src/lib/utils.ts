import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Remove Brazil DDI prefix (55) from phone numbers with 12-13 digits */
export function stripBrazilDDI(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits.slice(2)
  }
  return digits
}

/** Format number as BRL currency */
export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/** Strip all non-digit characters from CNPJ/CPF */
export function stripDocument(value: string): string {
  return value.replace(/\D/g, '')
}

/** Format 14-digit string as CNPJ (XX.XXX.XXX/XXXX-XX) */
export function formatCNPJ(value: string | null | undefined): string {
  if (!value) return '—'
  const d = stripDocument(value)
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return value
}

/** Format ISO date string to pt-BR short date */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Compute days since a given ISO date string */
export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null
  const diff = Date.now() - new Date(value).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
