'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ToastProps {
  message: string,
  type: 'error' | 'success' | 'info'
  onClose: () => void
}

function Toast({ message, type, onClose }: ToastProps) {
  const getToastStyles = () => {
    switch (type) {
      case 'error':
        return {
          container: 'bg-white border border-red-300 text-red-700',
          button: 'hover:bg-red-200 hover:text-red-700'
        }
      case 'success':
        return {
          container: 'bg-white border border-green-300 text-green-700',
          button: 'hover:bg-green-200 hover:text-green-700'
        }
      case 'info':
        return {
          container: 'bg-white border border-blue-300 text-blue-700',
          button: 'hover:bg-blue-200 hover:text-blue-700'
        }
      default:
        return {
          container: 'bg-white border border-gray-300 text-gray-700',
          button: 'hover:bg-gray-200 hover:text-gray-700'
        }
    }
  }

  const styles = getToastStyles()

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-auto min-w-0 flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-down duration-300 ${styles.container}`}>
      <span className="text-sm font-medium flex-1 min-w-0 break-words whitespace-pre-wrap leading-relaxed">{message}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={`h-6 w-6 p-0 flex-shrink-0 mt-0.5 ${styles.button}`}
      >
        <X className="h-4 w-4 shrink-0" />
      </Button>
    </div>
  )
}

interface ToastManagerState {
  message: string
  type: 'error' | 'success' | 'info'
  id: number
}

export function useToast() {
  const [toast, setToast] = useState<ToastManagerState | null>(null)
  
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToast({
      message,
      type,
      id: Date.now()
    })
  }

  const hideToast = () => {
    setToast(null)
  }

  useEffect(() => {
    if (toast) {
      // Calculate display duration based on message length
      // Minimum 4 seconds, add 50ms per character, maximum 12 seconds
      const baseTime = 4000
      const additionalTime = Math.min(toast.message.length * 50, 8000)
      const displayTime = Math.min(baseTime + additionalTime, 12000)
      
      const timer = setTimeout(() => {
        hideToast()
      }, displayTime)
      
      return () => clearTimeout(timer)
    }
  }, [toast])

  const ToastContainer = () => {
    if (!toast) return null
    
    return (
      <Toast 
        message={toast.message} 
        type={toast.type}
        onClose={hideToast} 
      />
    )
  }

  return {
    showToast,
    hideToast,
    ToastContainer
  }
}