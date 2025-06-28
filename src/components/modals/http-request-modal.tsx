'use client'

import React, { useState, useEffect } from 'react'
import { HTTPRequestConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Textarea } from '@/components/ui/textarea'
import { CustomSelect } from '@/components/ui/custom-select'
import { X, Plus, Trash2 } from 'lucide-react'

interface HTTPRequestModalProps {
  isOpen: boolean
  onClose: () => void
  config?: HTTPRequestConfig
  onSave: (config: HTTPRequestConfig) => void
}

export function HTTPRequestModal({ isOpen, onClose, config, onSave }: HTTPRequestModalProps) {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([])

  useEffect(() => {
    if (config) {
      setMethod(config.method)
      setUrl(config.url)
      setHeaders(config.headers || [])
    } else {
      setMethod('POST')
      setUrl('')
      setHeaders([])
    }
  }, [config, isOpen])

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }])
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers]
    newHeaders[index][field] = value
    setHeaders(newHeaders)
  }

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    const validHeaders = headers.filter(h => h.key.trim() !== '')
    onSave({
      method,
      url,
      headers: validHeaders
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Configure HTTP Request</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Request Method */}
          <div className="space-y-2">
            <Label htmlFor="method">Request Method</Label>
            <CustomSelect
              value={method}
              placeholder="Select Method"
              options={[
                { value: 'GET', label: 'GET' },
                { value: 'POST', label: 'POST' },
                { value: 'PUT', label: 'PUT' },
                { value: 'DELETE', label: 'DELETE' }
              ]}
              onChange={(value) => setMethod(value as any)}
              size="md"
            />
          </div>

          {/* Request URL */}
          <div className="space-y-2">
            <Label htmlFor="url">Request URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint/{param}"
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Use {'{param}'} format for path parameters that will be replaced from Tool Call arguments
            </p>
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Headers</Label>
              <Button variant="outline" size="sm" onClick={addHeader}>
                <Plus className="w-4 h-4 mr-2" />
                Add Header
              </Button>
            </div>
            
            {headers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No headers configured</p>
            ) : (
              <div className="space-y-2">
                {headers.map((header, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Header Key"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Header Value (use {param} for variables)"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeHeader(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!url.trim()}>
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  )
}
