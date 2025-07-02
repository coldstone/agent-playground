'use client'

import React, { useState } from 'react'
import { ChatSession, Agent } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { truncateText, formatTimestamp } from '@/lib/utils'
import { MessageSquare, Trash2, Edit2, Check, X, Plus, Bot } from 'lucide-react'
import { Title } from '@/components/layout'

interface SessionManagerProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  agents: Agent[]
  isNewChatDisabled?: boolean
  onSessionSelect: (sessionId: string) => void
  onSessionDelete: (sessionId: string) => void
  onSessionRename: (sessionId: string, newName: string) => void
  onNewChat: () => void
}

export function SessionManager({
  sessions,
  currentSessionId,
  agents,
  isNewChatDisabled = false,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onNewChat
}: SessionManagerProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleStartEdit = (session: ChatSession) => {
    setEditingSessionId(session.id)
    setEditingName(session.name)
  }

  const handleSaveEdit = () => {
    if (editingSessionId && editingName.trim()) {
      onSessionRename(editingSessionId, editingName.trim())
    }
    setEditingSessionId(null)
    setEditingName('')
  }

  const handleCancelEdit = () => {
    setEditingSessionId(null)
    setEditingName('')
  }

  const getSessionAgent = (session: ChatSession) => {
    // Show agent info if session has an agent
    if (session.agentId) {
      const agent = agents.find(a => a.id === session.agentId)
      if (agent) {
        return agent.name
      }
      return 'Agent (deleted)'
    }

    // No agent
    return null
  }

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo and Title Section */}
      <Title />

      {/* New Chat Button */}
      <div className="p-4 border-b border-border">
        <Button
          onClick={onNewChat}
          className="w-full"
          size="sm"
          rounded={true}
          disabled={isNewChatDisabled}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto mt-3">
        {sessions.length === 0 ? (
          <div className="p-4 mt-8 text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group relative rounded-lg border cursor-pointer transition-colors ${
                  currentSessionId === session.id
                    ? 'bg-primary/10 border-primary/20'
                    : 'hover:bg-muted border-transparent'
                }`}
              >
                {editingSessionId === session.id ? (
                  <div className="px-3 space-y-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        className="h-6 px-2"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="h-6 px-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-2 cursor-pointer"
                    onClick={() => onSessionSelect(session.id)}
                  >
                    <h4 className="font-medium text-sm truncate mb-1">
                      {session.name}
                    </h4>

                    {getSessionAgent(session) && (
                      <div className="flex items-center gap-1">
                        <Bot className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">
                          {getSessionAgent(session)}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400">
                        {formatTimestamp(session.updatedAt)}
                      </p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEdit(session)
                          }}
                          className="h-6 w-6 p-0 flex items-center justify-center"
                        >
                          <Edit2 className="w-3 h-3 flex-shrink-0" />
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSessionDelete(session.id)
                          }}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3 flex-shrink-0" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
