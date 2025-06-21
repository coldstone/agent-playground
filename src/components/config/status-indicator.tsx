'use client'

import React, { useState, useEffect } from 'react'
import { APIConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface StatusIndicatorProps {
  config: APIConfig
}

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error'

export function StatusIndicator({ config }: StatusIndicatorProps) {
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
      const testPayload = {
        model: config.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        stream: false
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Only add Authorization header if API key is provided
      if (config.apiKey.trim()) {
        headers['Authorization'] = `Bearer ${config.apiKey}`
      }

      const response = await fetch(config.endpoint, {
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
