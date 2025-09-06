'use client'

import { useState, useEffect } from 'react'
import { AvailableModel, CurrentModel } from '@/types'
import { IndexedDBManager } from '@/lib/storage/indexeddb'
import { devLog } from '@/lib/dev-utils'

export function useAvailableModels() {
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [currentModel, setCurrentModel] = useState<CurrentModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dbManager] = useState(() => IndexedDBManager.getInstance())

  const loadAvailableModels = async () => {
    try {
      const models = await dbManager.getAllAvailableModels()
      setAvailableModels(models)
    } catch (error) {
      devLog.error('Failed to load available models:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCurrentModel = () => {
    const saved = localStorage.getItem('agent-playground-current-model')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCurrentModel(parsed)
      } catch (error) {
        devLog.error('Failed to parse current model:', error)
        setCurrentModel(null)
      }
    } else {
      setCurrentModel(null)
    }
  }

  useEffect(() => {
    loadAvailableModels()
    loadCurrentModel()
  }, [])

  const hasAvailableModels = availableModels.length > 0

  // Check if current model is valid and available
  const hasValidCurrentModel = currentModel && availableModels.some(
    m => m.provider === currentModel.provider && m.model === currentModel.model
  )

  return {
    availableModels,
    currentModel,
    hasAvailableModels,
    hasValidCurrentModel,
    isLoading,
    refreshModels: loadAvailableModels
  }
}
