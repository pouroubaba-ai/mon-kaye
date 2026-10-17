import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFCFA(amount: number): string {
  const rounded = Math.round(amount || 0)
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA"
}

export function formatDateJJMMYYYY(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return String(dateInput)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}
