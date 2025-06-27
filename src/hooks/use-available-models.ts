'use client'

import { useState, useEffect } from 'react'
import { AvailableModel } from '@/types'
import { IndexedDBManager } from '@/lib/storage/indexeddb'

export function useAvailableModels() {
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dbManager] = useState(() => IndexedDBManager.getInstance())

  const loadAvailableModels = async () => {
    try {
      const models = await dbManager.getAllAvailableModels()
      setAvailableModels(models)
    } catch (error) {
      console.error('Failed to load available models:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAvailableModels()
    
    // Set up polling to check for model updates
    const interval = setInterval(loadAvailableModels, 1000)
    return () => clearInterval(interval)
  }, [])

  const hasAvailableModels = availableModels.length > 0

  return {
    availableModels,
    hasAvailableModels,
    isLoading,
    refreshModels: loadAvailableModels
  }
}
