'use client'

import { useState, useEffect } from 'react'
import { CurrentModel, APIConfig } from '@/types'
import { MODEL_PROVIDERS } from '@/lib'

export function useSystemModel() {
  const [systemModel, setSystemModel] = useState<CurrentModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSystemModel = () => {
    try {
      const saved = localStorage.getItem('agent-playground-system-model')
      if (saved) {
        const parsed = JSON.parse(saved)
        setSystemModel(parsed)
      } else {
        setSystemModel(null)
      }
    } catch (error) {
      console.error('Failed to parse system model:', error)
      setSystemModel(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSystemModel()
    
    // Set up polling to check for system model updates
    const interval = setInterval(loadSystemModel, 1000)
    return () => clearInterval(interval)
  }, [])

  const hasSystemModel = systemModel !== null

  // 从 System Model 生成 APIConfig
  const getSystemModelConfig = (): APIConfig | null => {
    if (!systemModel) return null

    try {
      // 获取保存的 API keys 和 endpoints
      const savedKeys = JSON.parse(localStorage.getItem('agent-playground-api-keys') || '{}')
      const savedEndpoints = JSON.parse(localStorage.getItem('agent-playground-api-endpoints') || '{}')

      // 找到对应的 provider 配置
      const provider = MODEL_PROVIDERS.find(p => p.name === systemModel.provider)
      if (!provider) return null

      const apiKey = savedKeys[systemModel.provider] || 'test-key'
      // For Azure OpenAI and Custom, don't use placeholder endpoint
      const endpoint = savedEndpoints[systemModel.provider] ||
        (provider.name === 'Azure OpenAI' || provider.name === 'Custom' ? '' : provider.endpoint)

      if (!endpoint) return null

      return {
        provider: systemModel.provider,
        endpoint,
        apiKey,
        model: systemModel.model,
        temperature: 0.7, // 默认值，用于 AI 生成
        maxTokens: undefined,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        systemPrompt: 'You are a helpful assistant.'
      }
    } catch (error) {
      console.error('Failed to generate system model config:', error)
      return null
    }
  }

  return {
    systemModel,
    hasSystemModel,
    isLoading,
    refreshSystemModel: loadSystemModel,
    getSystemModelConfig
  }
}
