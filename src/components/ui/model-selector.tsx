'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CurrentModel, AvailableModel } from '@/types'
import { ChevronDown } from 'lucide-react'
import { useAvailableModels } from '@/hooks/use-available-models'

interface ModelSelectorProps {
  onConfigLLM?: () => void
}

export function ModelSelector({ onConfigLLM }: ModelSelectorProps) {
  const { availableModels, hasAvailableModels } = useAvailableModels()
  const [currentModel, setCurrentModel] = useState<CurrentModel | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCurrentModel()
  }, [])

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
        console.error('Failed to parse current model:', error)
      }
    }
  }

  const saveCurrentModel = (model: CurrentModel) => {
    localStorage.setItem('agent-playground-current-model', JSON.stringify(model))
    setCurrentModel(model)
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
      // Current model is no longer available, clear it
      setCurrentModel(null)
      localStorage.removeItem('agent-playground-current-model')
      return 'Select Model'
    }

    return model.displayName
  }



  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border-none bg-gray-100 rounded-full"
      >
        <span className="truncate max-w-[240px]">
          {getCurrentModelDisplay()}
        </span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {isOpen && hasAvailableModels && (
        <div className="absolute bottom-full left-0 mb-1 bg-background border border-border rounded-md shadow-lg z-50 min-w-[250px] max-h-[300px] overflow-y-auto">
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
  )
}
