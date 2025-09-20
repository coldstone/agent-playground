'use client'

import React, { useState, useEffect } from 'react'
import { APIConfig, AvailableModel } from '@/types'
import { MODEL_PROVIDERS, DEFAULT_CONFIG, Provider, ProviderCustomConfig } from '@/lib/providers'
import { IndexedDBManager } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CustomSelect } from '@/components/ui/custom-select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { StatusIndicator } from './status-indicator'
import { Settings, Eye, EyeOff, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

interface APIConfigProps {
  config: APIConfig
  onConfigChange: (config: APIConfig) => void
}

export function APIConfigPanel({ config, onConfigChange }: APIConfigProps) {
  const [selectedProvider, setSelectedProvider] = useState<Provider>(MODEL_PROVIDERS[0])
  const [showApiKey, setShowApiKey] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [dbManager] = useState(() => IndexedDBManager.getInstance())
  const [providerConfigs, setProviderConfigs] = useState<ProviderCustomConfig[]>([])
  const [showModelSettings, setShowModelSettings] = useState(false)
  const [editingModels, setEditingModels] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [currentChatModel, setCurrentChatModel] = useState<any>(null)

  useEffect(() => {
    setIsClient(true)
    loadProviderConfigs()
    
    // Load initial current chat model
    setCurrentChatModel(getCurrentChatModel())
  }, [])

  // Listen for changes to current model in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'agent-playground-current-model') {
        setCurrentChatModel(getCurrentChatModel())
      }
    }

    // Listen for storage events from other tabs
    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for changes in the same tab by polling (since storage events don't fire in the same tab)
    const interval = setInterval(() => {
      const newModel = getCurrentChatModel()
      const currentModelStr = JSON.stringify(currentChatModel)
      const newModelStr = JSON.stringify(newModel)
      if (currentModelStr !== newModelStr) {
        setCurrentChatModel(newModel)
      }
    }, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [currentChatModel])

  useEffect(() => {
    // Find provider by name from config, fallback to first provider if not found
    const provider = MODEL_PROVIDERS.find(p => p.name === config.provider) || MODEL_PROVIDERS[0]
    setSelectedProvider(provider)

    // Update selected models for the new provider
    const currentProviderModels = availableModels
      .filter(m => m.provider === provider.name)
      .map(m => m.model)
    setSelectedModels(currentProviderModels)
  }, [config.provider, availableModels])

  const loadAvailableModels = async () => {
    try {
      const models = await dbManager.getAllAvailableModels()
      setAvailableModels(models)

      // Load selected models for current provider
      const currentProviderModels = models
        .filter(m => m.provider === selectedProvider.name)
        .map(m => m.model)
      setSelectedModels(currentProviderModels)
    } catch (error) {
      console.error('Failed to load available models:', error)
    }
  }

  const loadProviderConfigs = async () => {
    try {
      const configs = await dbManager.getAllProviderConfigs()
      setProviderConfigs(configs)

      // Load available models
      await loadAvailableModels()
    } catch (error) {
      console.error('Failed to load provider configs:', error)
    }
  }

  const handleModelToggle = async (model: string) => {
    const isSelected = selectedModels.includes(model)
    let newSelectedModels: string[]

    if (isSelected) {
      // Remove model
      newSelectedModels = selectedModels.filter(m => m !== model)

      // Remove from available models
      const modelId = `${selectedProvider.name}-${model}`
      try {
        await dbManager.deleteAvailableModel(modelId)
        // Notify other parts of the app to refresh available models
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('agent-playground-available-models-changed'))
        }
      } catch (error) {
        console.error('Failed to delete available model:', error)
      }
    } else {
      // Add model
      newSelectedModels = [...selectedModels, model]

      // Always add to available models when user selects it
      const availableModel: AvailableModel = {
        id: `${selectedProvider.name}-${model}`,
        provider: selectedProvider.name,
        model: model,
        displayName: `${selectedProvider.name} - ${model}`
      }

      try {
        await dbManager.saveAvailableModel(availableModel)
        // Notify other parts of the app to refresh available models
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('agent-playground-available-models-changed'))
        }
      } catch (error) {
        console.error('Failed to save available model:', error)
      }
    }

    setSelectedModels(newSelectedModels)

    // Reload available models to reflect changes immediately
    await loadAvailableModels()
  }



  const handleProviderChange = async (providerName: string) => {
    const provider = MODEL_PROVIDERS.find(p => p.name === providerName)
    if (provider) {
      setSelectedProvider(provider)

      // Load provider-specific configuration from IndexedDB
      const providerConfig = await dbManager.getProviderConfig(provider.name)

      // Load API key from consolidated storage
      const apiKeysStr = localStorage.getItem('agent-playground-api-keys')
      const apiKeys = apiKeysStr ? JSON.parse(apiKeysStr) : {}
      const apiKey = apiKeys[provider.name] || ''

      // For Custom provider, all configuration comes from IndexedDB
      if (provider.name === 'Custom') {
        onConfigChange({
          ...config,
          provider: provider.name,
          endpoint: providerConfig?.endpoint || '',
          model: providerConfig?.currentModel || 'custom-model',
          apiKey
        })
      } else if (provider.name === 'Azure OpenAI') {
        // For Azure OpenAI, load Azure-specific fields from provider config
        onConfigChange({
          ...config,
          provider: provider.name,
          endpoint: providerConfig?.endpoint || '',
          model: providerConfig?.currentModel || provider.defaultModel,
          apiKey,
          azureApiVersion: (providerConfig as any)?.azureApiVersion || '2025-04-01-preview'
        })
      } else {
        onConfigChange({
          ...config,
          provider: provider.name,
          endpoint: providerConfig?.endpoint || provider.endpoint,
          model: providerConfig?.currentModel || provider.defaultModel,
          apiKey
        })
      }
    }
  }

  const handleConfigChange = async (field: keyof APIConfig, value: any) => {
    const newConfig = {
      ...config,
      [field]: value
    }

    // 立即更新配置状态，避免光标跳转
    onConfigChange(newConfig)

    // Auto-save configurations (异步执行，不阻塞UI更新)
    if (isClient) {
      try {
        if (field === 'apiKey' && selectedProvider.requiresApiKey) {
          // Save API key to consolidated storage
          const apiKeysStr = localStorage.getItem('agent-playground-api-keys')
          const apiKeys = apiKeysStr ? JSON.parse(apiKeysStr) : {}
          apiKeys[selectedProvider.name] = value
          localStorage.setItem('agent-playground-api-keys', JSON.stringify(apiKeys))

          // API key changes shouldn't affect which models are available
          // Models are controlled by user selection in Available Deployments, not API key presence
          // Reload available models to ensure consistency
          await loadAvailableModels()
        } else if (field === 'endpoint') {
          await saveProviderConfig({ endpoint: value })
        } else if (field === 'model') {
          await saveProviderConfig({ currentModel: value })
        } else if (['azureApiVersion'].includes(field)) {
          // Save Azure OpenAI specific fields to provider config
          await saveProviderConfig({ [field]: value })
        } else if (['systemPrompt', 'temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'reasoningEffort', 'verbosity'].includes(field)) {
          // Save common settings to consolidated storage
          const llmConfigStr = localStorage.getItem('agent-playground-llm-config')
          const llmConfig = llmConfigStr ? JSON.parse(llmConfigStr) : {}
          if (value === undefined || value === null || (typeof value === 'number' && Number.isNaN(value))) {
            delete llmConfig[field]
          } else {
            llmConfig[field] = value
          }
          localStorage.setItem('agent-playground-llm-config', JSON.stringify(llmConfig))
        }
      } catch (error) {
        console.error('Failed to save config:', error)
      }
    }
  }

  const handleMaxTokensInput = (value: string) => {
    if (value.trim() === '') {
      handleConfigChange('maxTokens', undefined)
      return
    }

    const parsed = parseInt(value, 10)

    if (Number.isNaN(parsed)) {
      return
    }

    handleConfigChange('maxTokens', parsed)
  }

  const saveProviderConfig = async (updates: Partial<ProviderCustomConfig>) => {
    try {
      const existingConfig = await dbManager.getProviderConfig(selectedProvider.name)
      const newConfig: ProviderCustomConfig = {
        providerId: selectedProvider.name,
        ...existingConfig,
        ...updates
      }
      await dbManager.saveProviderConfig(newConfig)
      await loadProviderConfigs()
    } catch (error) {
      console.error('Failed to save provider config:', error)
    }
  }

  const getCurrentProviderConfig = () => {
    return providerConfigs.find(c => c.providerId === selectedProvider.name)
  }

  const getCurrentModels = () => {
    const customConfig = getCurrentProviderConfig()
    return customConfig?.models || selectedProvider.models
  }

  // Get current model from chat interface (not config panel)
  const getCurrentChatModel = () => {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const saved = localStorage.getItem('agent-playground-current-model')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to parse current model:', error)
    }
    return null
  }

  // Check if current model should hide temperature and top_p
  const shouldHideAdvancedParams = () => {
    const currentModel = currentChatModel?.model?.toLowerCase() || ''
    return currentModel.startsWith('o') || currentModel.startsWith('gpt-5')
  }

  // Check if current model is GPT-5 and should show GPT-5 specific params
  const shouldShowGPT5Params = () => {
    const currentModel = currentChatModel?.model?.toLowerCase() || ''
    return currentModel.startsWith('gpt-5')
  }

  const getModelGroups = () => {
    const models = getCurrentModels()

    // Group models by type for better organization
    const groups: { [key: string]: string[] } = {}

    models.forEach(model => {
      if (model.includes('gpt-4o')) {
        groups['GPT-4o Series'] = groups['GPT-4o Series'] || []
        groups['GPT-4o Series'].push(model)
      } else if (model.includes('gpt-4')) {
        groups['GPT-4 Series'] = groups['GPT-4 Series'] || []
        groups['GPT-4 Series'].push(model)
      } else if (model.includes('o1') || model.includes('o3') || model.includes('o4')) {
        groups['Reasoning Models'] = groups['Reasoning Models'] || []
        groups['Reasoning Models'].push(model)
      } else if (model.includes('deepseek')) {
        groups['DeepSeek Models'] = groups['DeepSeek Models'] || []
        groups['DeepSeek Models'].push(model)
      } else if (model.includes('qwen')) {
        groups['Qwen Models'] = groups['Qwen Models'] || []
        groups['Qwen Models'].push(model)
      } else if (model.includes('doubao')) {
        groups['Doubao Models'] = groups['Doubao Models'] || []
        groups['Doubao Models'].push(model)
      } else {
        groups['Other Models'] = groups['Other Models'] || []
        groups['Other Models'].push(model)
      }
    })

    // Convert to the format expected by CustomSelect
    return Object.entries(groups).map(([label, models]) => ({
      label,
      options: models.map(model => ({
        value: model,
        label: model
      }))
    }))
  }

  const handleModelSettingsOpen = () => {
    const currentModels = getCurrentModels()
    setEditingModels(currentModels.join('\n'))
    setShowModelSettings(true)
  }

  const handleModelSettingsSave = async () => {
    try {
      const newModels = editingModels.split('\n').map(m => m.trim()).filter(m => m)
      const oldModels = getCurrentModels()

      // Find models that were removed
      const removedModels = oldModels.filter(oldModel => !newModels.includes(oldModel))

      // Remove deleted models from available models and selected models
      for (const removedModel of removedModels) {
        const modelId = `${selectedProvider.name}-${removedModel}`
        try {
          await dbManager.deleteAvailableModel(modelId)
        } catch (error) {
          console.error('Failed to delete available model:', error)
        }
      }

      // Update selected models to only include models that still exist
      const updatedSelectedModels = selectedModels.filter(model => newModels.includes(model))
      setSelectedModels(updatedSelectedModels)

      // Save the new models list
      await saveProviderConfig({ models: newModels })
      setShowModelSettings(false)

      // Reload available models to reflect changes
      await loadAvailableModels()

      // Notify other parts of the app to refresh available models
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('agent-playground-available-models-changed'))
      }
    } catch (error) {
      console.error('Failed to save models:', error)
    }
  }

  return (
    <div className="space-y-4">{/* Remove wrapper div, will be handled by parent */}

      <div className="space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <CustomSelect
            value={selectedProvider.name}
            placeholder="Select Provider"
            options={MODEL_PROVIDERS.map(provider => ({
              value: provider.name,
              label: provider.name
            }))}
            onChange={(value) => handleProviderChange(value)}
            size="md"
          />
        </div>

        {/* API Endpoint */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="endpoint">API Endpoint</Label>
            {selectedProvider.name !== 'Custom' && selectedProvider.docsLink && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-xs"
                onClick={() => window.open(selectedProvider.docsLink, '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Docs
              </Button>
            )}
          </div>
          <Input
            id="endpoint"
            value={config.endpoint}
            onChange={(e) => handleConfigChange('endpoint', e.target.value)}
            placeholder={selectedProvider.name === 'Azure OpenAI' ? 'https://your-resource-name.openai.azure.com' : 
                        selectedProvider.name === 'Custom' ? 'https://api.example.com/v1/chat/completions' : 
                        selectedProvider.endpoint}
          />
        </div>

        {/* Azure OpenAI specific fields */}
        {selectedProvider.name === 'Azure OpenAI' && (
          <div className="space-y-2">
            <Label htmlFor="azureApiVersion">API Version</Label>
            <Input
              id="azureApiVersion"
              value={config.azureApiVersion || '2025-04-01-preview'}
              onChange={(e) => handleConfigChange('azureApiVersion', e.target.value)}
              placeholder="2025-04-01-preview"
            />
          </div>
        )}

        {/* API Key */}
        {selectedProvider.requiresApiKey && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey">
                {selectedProvider.name === 'Azure OpenAI' ? 'API Key' : 'API Key'}
              </Label>
              {config.apiKey && (
                <span className="text-xs text-green-600">
                  Saved
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                placeholder={selectedProvider.name === 'Azure OpenAI' ? 'your-api-key' : 'sk-...'}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Available Models Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="models">
              {selectedProvider.name === 'Azure OpenAI' ? 'Available Deployments' : 'Available Models'}
            </Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1"
              onClick={handleModelSettingsOpen}
            >
              <Settings className="w-3 h-3" />
            </Button>
          </div>
          <div className="border border-border rounded-md p-3 max-h-40 overflow-y-auto">
            {getCurrentModels().map((model) => (
              <label key={model} className="flex items-center space-x-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={selectedModels.includes(model)}
                  onChange={() => handleModelToggle(model)}
                  className="apg-checkbox"
                />
                <span className="text-sm">{model}</span>
              </label>
            ))}
          </div>
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            value={config.systemPrompt}
            onChange={(e) => handleConfigChange('systemPrompt', e.target.value)}
            placeholder="You are a helpful assistant."
            rows={3}
          />
        </div>

        {/* Connection Status */}
        <StatusIndicator 
          config={config} 
          selectedModels={selectedModels}
          providerName={selectedProvider.name}
        />

        {/* Advanced Parameters */}
        <div className="pt-4 border-t border-border">
            <div className="space-y-4 mt-4">
            
            {!shouldHideAdvancedParams() && (
              <Slider
                label="Temperature"
                min={0}
                max={2}
                step={0.1}
                value={config.temperature}
                onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                value={config.maxTokens ?? ''}
                onChange={(e) => handleMaxTokensInput(e.target.value)}
                min={1}
                max={32000}
              />
            </div>

            {!shouldHideAdvancedParams() && (
              <Slider
                label="Top P"
                min={0}
                max={1}
                step={0.1}
                value={config.topP}
                onChange={(e) => handleConfigChange('topP', parseFloat(e.target.value))}
              />
            )}

            <Slider
              label="Frequency Penalty"
              min={-2}
              max={2}
              step={0.1}
              value={config.frequencyPenalty}
              onChange={(e) => handleConfigChange('frequencyPenalty', parseFloat(e.target.value))}
            />

            <Slider
              label="Presence Penalty"
              min={-2}
              max={2}
              step={0.1}
              value={config.presencePenalty}
              onChange={(e) => handleConfigChange('presencePenalty', parseFloat(e.target.value))}
            />

            {/* GPT-5 specific parameters */}
            {shouldShowGPT5Params() && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reasoningEffort">Reasoning Effort</Label>
                  <CustomSelect
                    value={config.reasoningEffort || 'medium'}
                    onChange={(value) => handleConfigChange('reasoningEffort', value)}
                    options={[
                      { value: 'minimal', label: 'Minimal' },
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' }
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    Constrains effort on reasoning. Reducing effort can result in faster responses and fewer tokens.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verbosity">Verbosity</Label>
                  <CustomSelect
                    value={config.verbosity || 'medium'}
                    onChange={(value) => handleConfigChange('verbosity', value)}
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' }
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    Constrains the verbosity of responses. Lower values result in more concise responses.
                  </p>
                </div>
              </>
            )}
            </div>
        </div>
      </div>

      {/* Model Settings Modal */}
      {showModelSettings && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-96 max-w-[90vw] shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Models for {selectedProvider.name}</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="models" className="text-gray-700 dark:text-gray-300">Models (one per line)</Label>
                <Textarea
                  id="models"
                  value={editingModels}
                  onChange={(e) => setEditingModels(e.target.value)}
                  rows={10}
                  className="mt-2"
                  placeholder="Enter model names, one per line..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowModelSettings(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleModelSettingsSave}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
