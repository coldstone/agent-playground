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

  // Listen for available models changes broadcasted by config panel
  useEffect(() => {
    const handler = () => {
      loadAvailableModels()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('agent-playground-available-models-changed', handler)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('agent-playground-available-models-changed', handler)
      }
    }
  }, [])

  // Listen for current model changes (same-tab via custom event, cross-tab via storage)
  useEffect(() => {
    const onCustom = () => loadCurrentModel()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'agent-playground-current-model') {
        loadCurrentModel()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('agent-playground-current-model-changed', onCustom as EventListener)
      window.addEventListener('storage', onStorage)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('agent-playground-current-model-changed', onCustom as EventListener)
        window.removeEventListener('storage', onStorage)
      }
    }
  }, [])

  const hasAvailableModels = availableModels.length > 0

  // Check if current model is valid and available
  // Don't validate if models are still loading
  const hasValidCurrentModel = !!(currentModel && !isLoading && availableModels.some(
    m => m.provider === currentModel.provider && m.model === currentModel.model
  ))

  return {
    availableModels,
    currentModel,
    hasAvailableModels,
    hasValidCurrentModel,
    isLoading,
    refreshModels: loadAvailableModels
  }
}
