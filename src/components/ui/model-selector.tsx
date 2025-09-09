'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CurrentModel, AvailableModel } from '@/types'
import { ChevronDown } from 'lucide-react'
import { useAvailableModels } from '@/hooks/use-available-models'
import { devLog } from '@/lib/dev-utils'
import { MODEL_PROVIDERS } from '@/lib/providers'

interface ModelSelectorProps {
  onConfigLLM?: () => void
  autoMode?: boolean
  onAutoModeChange?: (enabled: boolean) => void
  showAutoSwitch?: boolean
}

export function ModelSelector({ onConfigLLM, autoMode = false, onAutoModeChange, showAutoSwitch = true }: ModelSelectorProps) {
  const { availableModels, hasAvailableModels } = useAvailableModels()
  const [currentModel, setCurrentModel] = useState<CurrentModel | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCurrentModel()
  }, [])

  // When available models change, ensure currentModel is still valid
  useEffect(() => {
    if (!currentModel) return
    
    // Don't check if availableModels is empty (still loading)
    if (availableModels.length === 0) return
    
    const stillAvailable = availableModels.some(
      m => m.provider === currentModel.provider && m.model === currentModel.model
    )
    if (!stillAvailable) {
      devLog.warn('Current model is no longer available, clearing:', currentModel, 'Available models:', availableModels)
      setCurrentModel(null)
      try {
        localStorage.removeItem('agent-playground-current-model')
        // Broadcast change so other components update immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agent-playground-current-model-changed', { detail: null }))
        }
      } catch (e) {
        // ignore
      }
    }
  }, [availableModels, currentModel])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])



  const loadCurrentModel = () => {
    const saved = localStorage.getItem('agent-playground-current-model')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCurrentModel(parsed)
      } catch (error) {
        devLog.error('Failed to parse current model:', error)
      }
    }
  }

  const saveCurrentModel = (model: CurrentModel) => {
    localStorage.setItem('agent-playground-current-model', JSON.stringify(model))
    setCurrentModel(model)
    // Notify other parts of the app (same-tab) that current model changed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agent-playground-current-model-changed', { detail: model }))
    }
  }

  const handleModelSelect = (model: AvailableModel) => {
    const newCurrentModel: CurrentModel = {
      provider: model.provider,
      model: model.model
    }
    saveCurrentModel(newCurrentModel)
    setIsOpen(false)
  }



  // Group models by provider
  const groupedModels = availableModels.reduce((groups, model) => {
    if (!groups[model.provider]) {
      groups[model.provider] = []
    }
    groups[model.provider].push(model)
    return groups
  }, {} as Record<string, AvailableModel[]>)

  const getCurrentModelDisplay = () => {
    if (!hasAvailableModels) return 'No models available'

    if (!currentModel) return 'Select Model'

    // Check if current model is still available
    const model = availableModels.find(
      m => m.provider === currentModel.provider && m.model === currentModel.model
    )

    if (!model) {
      // Current model is no longer available
      return 'Select Model'
    }

    return model.model
  }



  return (
    <div className="flex items-center gap-3">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border bg-muted rounded-full"
        >
          {currentModel && (() => {
            const model = availableModels.find(
              m => m.provider === currentModel.provider && m.model === currentModel.model
            )
            if (model) {
              const providerConfig = MODEL_PROVIDERS.find(p => p.name === model.provider)
              if (providerConfig && providerConfig.icon) {
                return (
                  <img 
                    src={`/${providerConfig.icon}.svg`}
                    alt={model.provider}
                    className="w-3 h-3 flex-shrink-0 dark:invert"
                  />
                )
              }
            }
            return null
          })()}
          <span className="truncate max-w-[240px]">
            {getCurrentModelDisplay()}
          </span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>

        {isOpen && hasAvailableModels && (
          <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-md shadow-lg z-50 min-w-[250px] max-h-[300px] overflow-y-auto">
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border">
                  {provider}
                </div>
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                      currentModel?.provider === model.provider && currentModel?.model === model.model
                        ? 'bg-primary/10 text-primary'
                        : ''
                    }`}
                  >
                    {model.model}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto switch - only show in Agent mode */}
      {onAutoModeChange && showAutoSwitch && (
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoMode}
              onChange={(e) => onAutoModeChange(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${
              autoMode ? 'bg-green-500' : 'bg-muted'
            }`}>
              <div className={`w-4 h-4 bg-card rounded-full shadow transform transition-transform ${
                autoMode ? 'translate-x-6' : 'translate-x-1'
              } mt-1`} />
            </div>
          </label>
          <span className="text-xs text-muted-foreground">Auto</span>
        </div>
      )}
    </div>
  )
}
