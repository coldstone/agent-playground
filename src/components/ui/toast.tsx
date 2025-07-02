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
  const bgColor = {
    error: 'red',
    success: 'green',
    info: 'blue'
  }[type]

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 bg-${bgColor}-100 border border-${bgColor}-300 text-${bgColor}-700 px-4 py-2 rounded-full shadow-md animate-slide-down duration-300`}>
      <span className="text-sm font-medium shrink-0">{message}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={`h-6 w-6 p-0 hover:bg-${bgColor}-200 hover:text-${bgColor}-700`}
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
      const timer = setTimeout(() => {
        hideToast()
      }, 5000)
      
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