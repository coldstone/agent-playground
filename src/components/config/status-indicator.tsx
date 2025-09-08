'use client'

import React, { useState, useEffect } from 'react'
import { APIConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface StatusIndicatorProps {
  config: APIConfig
  selectedModels?: string[]
  providerName?: string
}

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error'

export function StatusIndicator({ config, selectedModels = [], providerName = '' }: StatusIndicatorProps) {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const testConnection = async () => {
    if (!config.endpoint.trim()) {
      setStatus('error')
      setErrorMessage('No endpoint configured')
      return
    }

    setStatus('testing')
    setErrorMessage('')

    try {
      let testPayload: any
      let headers: Record<string, string>
      let testEndpoint: string

      if (providerName === 'Azure OpenAI') {
        // Azure OpenAI specific logic
        const firstSelectedModel = selectedModels.length > 0 ? selectedModels[0] : config.model || 'gpt-35-turbo'
        // Use default API version if not configured
        const apiVersion = (config.azureApiVersion && config.azureApiVersion.trim()) || '2025-04-01-preview'

        // Build Azure OpenAI endpoint
        let resourceEndpoint = config.endpoint
        
        // Remove protocol if present
        if (resourceEndpoint.startsWith('https://')) {
          resourceEndpoint = resourceEndpoint.substring(8)
        } else if (resourceEndpoint.startsWith('http://')) {
          resourceEndpoint = resourceEndpoint.substring(7)
        }
        
        // Remove any trailing path
        resourceEndpoint = resourceEndpoint.split('/')[0]
        
        // If it doesn't include the full domain, add it
        if (!resourceEndpoint.includes('.openai.azure.com')) {
          resourceEndpoint = `${resourceEndpoint}.openai.azure.com`
        }

        testEndpoint = `https://${resourceEndpoint}/openai/deployments/${firstSelectedModel}/chat/completions?api-version=${apiVersion}`
        
        // Check if model should exclude temperature and top_p
        const modelName = firstSelectedModel.toLowerCase()
        const shouldExcludeAdvancedParams = modelName.startsWith('o') || modelName.startsWith('gpt-5')
        
        testPayload = {
          // Azure OpenAI doesn't need model parameter
          messages: [{ role: 'user', content: 'test' }],
          max_completion_tokens: 4, // Minimum for Azure OpenAI
          stream: false
        }
        
        // Only add temperature and top_p for models that support them
        if (!shouldExcludeAdvancedParams) {
          testPayload.temperature = 0.7
          testPayload.top_p = 1
        }

        headers = {
          'Content-Type': 'application/json',
          'api-key': config.apiKey // Azure uses api-key header
        }
      } else {
        // Standard OpenAI-compatible logic
        testPayload = {
          model: config.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          stream: false
        }

        headers = {
          'Content-Type': 'application/json'
        }

        // Only add Authorization header if API key is provided
        if (config.apiKey.trim()) {
          headers['Authorization'] = `Bearer ${config.apiKey}`
        }

        testEndpoint = config.endpoint
      }

      const response = await fetch(testEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
      })

      if (response.ok || response.status === 400) {
        // 400 might be expected for test payload, but means endpoint is reachable
        setStatus('connected')
      } else {
        setStatus('error')
        const errorData = await response.json().catch(() => ({}))
        setErrorMessage(`${response.status}: ${errorData.error?.message || response.statusText}`)
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'testing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'testing':
        return 'Testing...'
      case 'connected':
        return 'Connected'
      case 'error':
        return 'Error'
      default:
        return 'Not tested'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'testing':
        return 'text-blue-600'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Connection Status</span>
        <Button
          variant="outline"
          size="sm"
          onClick={testConnection}
          disabled={status === 'testing' || !config.endpoint.trim()}
        >
          Test
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className={`text-sm ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {status === 'error' && errorMessage && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {errorMessage}
        </div>
      )}

      {status === 'connected' && (
        <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
          API endpoint is reachable
        </div>
      )}
    </div>
  )
}
