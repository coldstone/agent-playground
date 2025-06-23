'use client'

import React, { useState, useEffect } from 'react'
import { IndexedDBManager } from '@/lib/storage'

export default function DebugPage() {
  const [dbData, setDbData] = useState<any>({})
  const [localStorageData, setLocalStorageData] = useState<any>({})
  const [dbManager] = useState(() => IndexedDBManager.getInstance())

  useEffect(() => {
    const loadDebugData = async () => {
      try {
        // Initialize IndexedDB
        await dbManager.init()
        
        // Load all data from IndexedDB
        const [sessions, agents, tools, providerConfigs] = await Promise.all([
          dbManager.getAllSessions(),
          dbManager.getAllAgents(),
          dbManager.getAllTools(),
          dbManager.getAllProviderConfigs()
        ])
        
        setDbData({
          sessions,
          agents,
          tools,
          providerConfigs
        })
        
        // Load localStorage data
        const localData = {
          currentProvider: localStorage.getItem('agent-playground-current-provider'),
          currentSession: localStorage.getItem('agent-playground-current-session'),
          currentAgent: localStorage.getItem('agent-playground-current-agent'),
          llmConfig: localStorage.getItem('agent-playground-llm-config'),
          apiKeys: localStorage.getItem('agent-playground-api-keys')
        }
        
        setLocalStorageData(localData)
        
      } catch (error) {
        console.error('Debug data load error:', error)
      }
    }
    
    loadDebugData()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Data</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">IndexedDB Data</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Sessions ({dbData.sessions?.length || 0})</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                {JSON.stringify(dbData.sessions, null, 2)}
              </pre>
            </div>
            
            <div>
              <h3 className="font-medium">Agents ({dbData.agents?.length || 0})</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                {JSON.stringify(dbData.agents, null, 2)}
              </pre>
            </div>
            
            <div>
              <h3 className="font-medium">Tools ({dbData.tools?.length || 0})</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                {JSON.stringify(dbData.tools, null, 2)}
              </pre>
            </div>
            
            <div>
              <h3 className="font-medium">Provider Configs ({dbData.providerConfigs?.length || 0})</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                {JSON.stringify(dbData.providerConfigs, null, 2)}
              </pre>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">localStorage Data</h2>
          <div className="space-y-4">
            {Object.entries(localStorageData).map(([key, value]) => (
              <div key={key}>
                <h3 className="font-medium">{key}</h3>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                  {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
