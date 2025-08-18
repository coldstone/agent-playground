'use client'

import React, { useState, forwardRef, useImperativeHandle } from 'react'
import { Authorization, Tool } from '@/types'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { generateId } from '@/lib'
import { getToolTags } from '@/lib/authorization'
import { 
  Edit3, 
  Trash2, 
  Plus, 
  Key, 
  Star, 
  StarOff,
  ChevronDown,
  ChevronRight,
  Globe,
  Tag
} from 'lucide-react'

interface AuthorizationsPanelProps {
  authorizations: Authorization[]
  tools: Tool[]
  onAuthorizationCreate: (authorization: Authorization) => Promise<string>
  onAuthorizationUpdate: (authorization: Authorization) => Promise<void>
  onAuthorizationDelete: (authorizationId: string) => Promise<void>
}

export interface AuthorizationsPanelRef {
  openCreateModal: () => void
}

export const AuthorizationsPanel = forwardRef<AuthorizationsPanelRef, AuthorizationsPanelProps>(({
  authorizations,
  tools,
  onAuthorizationCreate,
  onAuthorizationUpdate,
  onAuthorizationDelete
}, ref) => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAuth, setEditingAuth] = useState<Authorization | null>(null)
  const [expandedAuths, setExpandedAuths] = useState<Set<string>>(new Set())

  useImperativeHandle(ref, () => ({
    openCreateModal: () => setShowCreateModal(true)
  }))

  const toolTags = getToolTags(tools)

  // Group authorizations by tag
  const groupedAuthorizations = React.useMemo(() => {
    const groups: { [key: string]: Authorization[] } = {}
    
    authorizations.forEach(auth => {
      const key = auth.tag || 'global'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(auth)
    })

    return groups
  }, [authorizations])

  const toggleExpanded = (authId: string) => {
    setExpandedAuths(prev => {
      const newSet = new Set(prev)
      if (newSet.has(authId)) {
        newSet.delete(authId)
      } else {
        newSet.add(authId)
      }
      return newSet
    })
  }

  const handleEdit = (auth: Authorization) => {
    setEditingAuth(auth)
    setShowCreateModal(true)
  }

  const handleDelete = async (authId: string) => {
    if (confirm('Are you sure you want to delete this authorization?')) {
      try {
        await onAuthorizationDelete(authId)
      } catch (error) {
        console.error('Failed to delete authorization:', error)
      }
    }
  }

  const handleToggleDefault = async (auth: Authorization) => {
    try {
      const newIsDefault = !auth.isDefaultInTag
      
      if (newIsDefault) {
        // If setting as default, first remove default from other auths in the same group
        const sameGroupAuths = authorizations.filter(a => 
          a.tag === auth.tag && a.id !== auth.id && a.isDefaultInTag
        )
        
        // Remove default from other auths in the same group
        for (const otherAuth of sameGroupAuths) {
          await onAuthorizationUpdate({
            ...otherAuth,
            isDefaultInTag: false,
            updatedAt: Date.now()
          })
        }
      }
      
      // Update the clicked auth
      await onAuthorizationUpdate({
        ...auth,
        isDefaultInTag: newIsDefault,
        updatedAt: Date.now()
      })
    } catch (error) {
      console.error('Failed to update authorization:', error)
    }
  }

  const handleModalClose = () => {
    setShowCreateModal(false)
    setEditingAuth(null)
  }

  return (
    <div className="space-y-4">
      {/* Authorization Groups */}
      <div className="space-y-3">
        {Object.entries(groupedAuthorizations).map(([groupKey, auths]) => (
          <div key={groupKey} className="border rounded-lg">
            {/* Group Header */}
            <div className="flex items-center gap-2 p-2 bg-gray-50 border-b">
              {groupKey === 'global' ? (
                <>
                  <Globe className="w-3 h-3 text-blue-500" />
                  <span className="text-xs font-medium">Global (All Tools)</span>
                </>
              ) : (
                <>
                  <Tag className="w-3 h-3 text-green-500" />
                  <span className="text-xs font-medium">Tag: {groupKey}</span>
                </>
              )}
              <span className="text-xs text-gray-400">({auths.length})</span>
            </div>

            {/* Authorizations in Group */}
            <div className="divide-y">
              {auths.map(auth => (
                <div key={auth.id} className="p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpanded(auth.id)}
                        className="p-0.5 hover:bg-gray-100 rounded"
                      >
                        {expandedAuths.has(auth.id) ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                      <div>
                        <span className="text-xs font-medium">{auth.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleToggleDefault(auth)}
                        title={auth.isDefaultInTag ? "Remove as default" : "Set as default"}
                        className="h-6 w-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star className={`w-3 h-3 ${auth.isDefaultInTag ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                      </button>
                      <button
                        onClick={() => handleEdit(auth)}
                        className="h-6 w-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-3 h-3 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(auth.id)}
                        className="h-6 w-6 flex items-center justify-center hover:bg-red-100 text-red-600 hover:text-red-700 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedAuths.has(auth.id) && (
                    <div className="mt-2 pl-4 space-y-2">
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-1">Headers:</h4>
                        {auth.headers.length > 0 ? (
                          <div className="space-y-1">
                            {auth.headers.map((header, index) => (
                              <div key={index} className="text-xs font-mono text-gray-600 truncate">
                                <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded">{header.key}</span>
                                <span className="text-gray-400">: </span>
                                <span className="text-gray-500">
                                  {header.value.length > 30 
                                    ? `${header.value.substring(0, 30)}...` 
                                    : header.value
                                  }
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No headers defined</p>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        Created: {new Date(auth.createdAt).toLocaleDateString()}
                        {auth.updatedAt !== auth.createdAt && (
                          <span> • Updated: {new Date(auth.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {authorizations.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Key className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-xs">No authorizations created yet</p>
            <p className="text-xs text-gray-400">Create your first authorization to get started</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <AuthorizationModal
          authorization={editingAuth}
          availableTags={toolTags}
          onSave={async (authData) => {
            try {
              if (editingAuth) {
                await onAuthorizationUpdate({
                  ...authData,
                  id: editingAuth.id,
                  createdAt: editingAuth.createdAt,
                  updatedAt: Date.now()
                })
              } else {
                const newAuth = {
                  ...authData,
                  id: generateId(),
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                }
                await onAuthorizationCreate(newAuth)
              }
              handleModalClose()
            } catch (error) {
              console.error('Failed to save authorization:', error)
              // Don't close modal on error, let user retry
            }
          }}
          onCancel={handleModalClose}
        />
      )}
    </div>
  )
})

AuthorizationsPanel.displayName = 'AuthorizationsPanel'

// Authorization Create/Edit Modal Component
interface AuthorizationModalProps {
  authorization?: Authorization | null
  availableTags: string[]
  onSave: (authorization: Omit<Authorization, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}

function AuthorizationModal({ authorization, availableTags, onSave, onCancel }: AuthorizationModalProps) {
  const [name, setName] = useState(authorization?.name || '')
  const [tag, setTag] = useState<string>(authorization?.tag || '')
  const [customTag, setCustomTag] = useState('')
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(
    authorization?.headers || [{ key: '', value: '' }]
  )
  const [isDefaultInTag, setIsDefaultInTag] = useState(authorization?.isDefaultInTag || false)

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }])
  }

  const handleUpdateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers]
    newHeaders[index][field] = value
    setHeaders(newHeaders)
  }

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const finalTag = tag === 'custom' ? customTag.trim() : tag
    const validHeaders = headers.filter(h => h.key && h.value)

    await onSave({
      name,
      tag: finalTag || undefined,
      headers: validHeaders,
      isDefaultInTag
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {authorization ? 'Edit Authorization' : 'Create Authorization'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="e.g., CRM Appkey"
              required
            />
          </div>

          {/* Tag Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Tag (Optional)</label>
            <p className="text-xs text-gray-500 mb-2">Only tools with this tag can use this authorization</p>
            <CustomSelect
              value={tag}
              onChange={(value) => setTag(value)}
              options={[
                { value: '', label: 'Global (All Tools)' },
                ...availableTags.map(tagOption => ({
                  value: tagOption,
                  label: tagOption
                })),
                { value: 'custom', label: 'Custom Tag...' }
              ]}
              placeholder="Select tag type"
              size="md"
            />
            
            {tag === 'custom' && (
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                className="w-full p-2 border rounded-md mt-2"
                placeholder="Enter custom tag"
              />
            )}
          </div>

          {/* Default Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefaultInTag}
              onChange={(e) => setIsDefaultInTag(e.target.checked)}
            />
            <label htmlFor="isDefault" className="text-sm">
              Set as default for this tag
            </label>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Headers</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddHeader}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Header
              </Button>
            </div>
            
            <div className="space-y-2">
              {headers.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={header.key}
                    onChange={(e) => handleUpdateHeader(index, 'key', e.target.value)}
                    className="flex-1 p-2 border rounded-md text-sm"
                    placeholder="Header name (e.g., Authorization)"
                  />
                  <input
                    type="text"
                    value={header.value}
                    onChange={(e) => handleUpdateHeader(index, 'value', e.target.value)}
                    className="flex-1 p-2 border rounded-md text-sm"
                    placeholder="Header value (e.g., Bearer xxx)"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveHeader(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
            >
              {authorization ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}