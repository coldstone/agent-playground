/**
 * Development mode utilities for conditional logging
 */

export const isDevelopment = process.env.NODE_ENV === 'development'

/**
 * Console logging that only works in development mode
 */
export const devLog = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },
  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.error(...args)
    }
  },
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  }
}