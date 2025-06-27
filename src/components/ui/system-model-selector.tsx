'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CurrentModel } from '@/types'
import { ChevronDown } from 'lucide-react'
import { useAvailableModels } from '@/hooks/use-available-models'
import { useSystemModel } from '@/hooks/use-system-model'

export function SystemModelSelector() {
  const { availableModels, hasAvailableModels } = useAvailableModels()
  const { systemModel, refreshSystemModel } = useSystemModel()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const saveCurrentModel = (model: CurrentModel) => {
    localStorage.setItem('agent-playground-system-model', JSON.stringify(model))
    refreshSystemModel()
  }

  const handleModelSelect = (model: any) => {
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
  }, {} as Record<string, any[]>)

  const getCurrentModelDisplay = () => {
    if (!hasAvailableModels) return 'No models available'

    if (!systemModel) return 'Select Model'

    // Check if current model is still available
    const model = availableModels.find(
      m => m.provider === systemModel.provider && m.model === systemModel.model
    )

    if (!model) {
      // Current model is no longer available, clear it
      localStorage.removeItem('agent-playground-system-model')
      refreshSystemModel()
      return 'Select Model'
    }

    return model.displayName
  }

  return (
    <div className="space-y-2">
      {/* Title and Description */}
      <div>
        <h4 className="text-sm font-medium text-foreground">System Model</h4>
        <p className="text-xs text-muted-foreground mt-1 ml-1">
          Model used for AI generation of Agents, Tools
        </p>
      </div>

      {/* Model Selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-md bg-background hover:bg-muted transition-colors"
        >
          <span className="truncate">
            {getCurrentModelDisplay()}
          </span>
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        </button>

        {isOpen && hasAvailableModels && (
          <div className="absolute top-full left-0 mt-1 w-full bg-background border border-border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
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
                      systemModel?.provider === model.provider && systemModel?.model === model.model
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

      {/* Separator */}
      <div className="mt-4 border-b border-border pt-4"></div>
    </div>
  )
}
