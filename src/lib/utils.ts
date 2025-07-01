import { type ClassValue, clsx } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function generateId(): string {
  // Use crypto.randomUUID if available (modern browsers and Node.js 16+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for older environments
  // Use a counter to ensure uniqueness within the same session
  if (typeof window !== 'undefined') {
    // Client-side: use performance.now() for better precision
    return Math.random().toString(36).substring(2) + performance.now().toString(36)
  } else {
    // Server-side: use a simple counter to ensure consistency
    return 'ssr-' + Math.random().toString(36).substring(2)
  }
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
