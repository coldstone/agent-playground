import { Agent, Tool, ChatSession, AvailableModel } from '@/types'
import { ProviderCustomConfig } from '../providers'

const DB_NAME = 'agent-playground'
const DB_VERSION = 3

// Store names
const AGENTS_STORE = 'agents'
const TOOLS_STORE = 'tools'
const SESSIONS_STORE = 'sessions'
const PROVIDER_CONFIGS_STORE = 'provider-configs'
const AVAILABLE_MODELS_STORE = 'available-models'

export class IndexedDBManager {
  private static instance: IndexedDBManager
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  private constructor() {}

  static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager()
    }
    return IndexedDBManager.instance
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve()
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create agents store
        if (!db.objectStoreNames.contains(AGENTS_STORE)) {
          const agentsStore = db.createObjectStore(AGENTS_STORE, { keyPath: 'id' })
          agentsStore.createIndex('name', 'name', { unique: false })
          agentsStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Create tools store
        if (!db.objectStoreNames.contains(TOOLS_STORE)) {
          const toolsStore = db.createObjectStore(TOOLS_STORE, { keyPath: 'id' })
          toolsStore.createIndex('name', 'name', { unique: false })
          toolsStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Create sessions store
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
          sessionsStore.createIndex('name', 'name', { unique: false })
          sessionsStore.createIndex('createdAt', 'createdAt', { unique: false })
          sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        }

        // Create provider configs store
        if (!db.objectStoreNames.contains(PROVIDER_CONFIGS_STORE)) {
          const providerConfigsStore = db.createObjectStore(PROVIDER_CONFIGS_STORE, { keyPath: 'providerId' })
        }

        // Create available models store
        if (!db.objectStoreNames.contains(AVAILABLE_MODELS_STORE)) {
          const availableModelsStore = db.createObjectStore(AVAILABLE_MODELS_STORE, { keyPath: 'id' })
          availableModelsStore.createIndex('provider', 'provider', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB')
    }
    return this.db
  }

  // Generic CRUD operations
  private async add<T>(storeName: string, item: T): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.add(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private async update<T>(storeName: string, item: T): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.put(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private async delete(storeName: string, id: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private async get<T>(storeName: string, id: string): Promise<T | null> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result || [])
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Agent operations
  async saveAgent(agent: Agent): Promise<void> {
    try {
      await this.update(AGENTS_STORE, agent)
    } catch (error) {
      console.error('Failed to save agent:', error)
      throw error
    }
  }

  async getAgent(id: string): Promise<Agent | null> {
    try {
      return await this.get<Agent>(AGENTS_STORE, id)
    } catch (error) {
      console.error('Failed to get agent:', error)
      return null
    }
  }

  async getAllAgents(): Promise<Agent[]> {
    try {
      return await this.getAll<Agent>(AGENTS_STORE)
    } catch (error) {
      console.error('Failed to get all agents:', error)
      return []
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      await this.delete(AGENTS_STORE, id)
    } catch (error) {
      console.error('Failed to delete agent:', error)
      throw error
    }
  }

  // Tool operations
  async saveTool(tool: Tool): Promise<void> {
    try {
      await this.update(TOOLS_STORE, tool)
    } catch (error) {
      console.error('Failed to save tool:', error)
      throw error
    }
  }

  async getTool(id: string): Promise<Tool | null> {
    try {
      return await this.get<Tool>(TOOLS_STORE, id)
    } catch (error) {
      console.error('Failed to get tool:', error)
      return null
    }
  }

  async getAllTools(): Promise<Tool[]> {
    try {
      return await this.getAll<Tool>(TOOLS_STORE)
    } catch (error) {
      console.error('Failed to get all tools:', error)
      return []
    }
  }

  async deleteTool(id: string): Promise<void> {
    try {
      await this.delete(TOOLS_STORE, id)
    } catch (error) {
      console.error('Failed to delete tool:', error)
      throw error
    }
  }

  // Session operations
  async saveSession(session: ChatSession): Promise<void> {
    try {
      await this.update(SESSIONS_STORE, session)
    } catch (error) {
      console.error('Failed to save session:', error)
      throw error
    }
  }

  async getSession(id: string): Promise<ChatSession | null> {
    try {
      return await this.get<ChatSession>(SESSIONS_STORE, id)
    } catch (error) {
      console.error('Failed to get session:', error)
      return null
    }
  }

  async getAllSessions(): Promise<ChatSession[]> {
    try {
      const sessions = await this.getAll<ChatSession>(SESSIONS_STORE)
      // Sort by updatedAt descending
      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } catch (error) {
      console.error('Failed to get all sessions:', error)
      return []
    }
  }

  async deleteSession(id: string): Promise<void> {
    try {
      await this.delete(SESSIONS_STORE, id)
    } catch (error) {
      console.error('Failed to delete session:', error)
      throw error
    }
  }

  // Provider config operations
  async saveProviderConfig(config: ProviderCustomConfig): Promise<void> {
    try {
      await this.update(PROVIDER_CONFIGS_STORE, config)
    } catch (error) {
      console.error('Failed to save provider config:', error)
      throw error
    }
  }

  async getProviderConfig(providerId: string): Promise<ProviderCustomConfig | null> {
    try {
      return await this.get<ProviderCustomConfig>(PROVIDER_CONFIGS_STORE, providerId)
    } catch (error) {
      console.error('Failed to get provider config:', error)
      return null
    }
  }

  async getAllProviderConfigs(): Promise<ProviderCustomConfig[]> {
    try {
      return await this.getAll<ProviderCustomConfig>(PROVIDER_CONFIGS_STORE)
    } catch (error) {
      console.error('Failed to get all provider configs:', error)
      return []
    }
  }

  async deleteProviderConfig(providerId: string): Promise<void> {
    try {
      await this.delete(PROVIDER_CONFIGS_STORE, providerId)
    } catch (error) {
      console.error('Failed to delete provider config:', error)
      throw error
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AGENTS_STORE, TOOLS_STORE, SESSIONS_STORE, PROVIDER_CONFIGS_STORE], 'readwrite')

      const agentsStore = transaction.objectStore(AGENTS_STORE)
      const toolsStore = transaction.objectStore(TOOLS_STORE)
      const sessionsStore = transaction.objectStore(SESSIONS_STORE)
      const providerConfigsStore = transaction.objectStore(PROVIDER_CONFIGS_STORE)

      Promise.all([
        new Promise<void>((res, rej) => {
          const req = agentsStore.clear()
          req.onsuccess = () => res()
          req.onerror = () => rej(req.error)
        }),
        new Promise<void>((res, rej) => {
          const req = toolsStore.clear()
          req.onsuccess = () => res()
          req.onerror = () => rej(req.error)
        }),
        new Promise<void>((res, rej) => {
          const req = sessionsStore.clear()
          req.onsuccess = () => res()
          req.onerror = () => rej(req.error)
        }),
        new Promise<void>((res, rej) => {
          const req = providerConfigsStore.clear()
          req.onsuccess = () => res()
          req.onerror = () => rej(req.error)
        })
      ]).then(() => resolve()).catch(reject)
    })
  }

  // Available Models operations
  async saveAvailableModel(model: AvailableModel): Promise<void> {
    return this.add(AVAILABLE_MODELS_STORE, model)
  }

  async getAvailableModel(id: string): Promise<AvailableModel | null> {
    return this.get(AVAILABLE_MODELS_STORE, id)
  }

  async getAllAvailableModels(): Promise<AvailableModel[]> {
    return this.getAll(AVAILABLE_MODELS_STORE)
  }

  async updateAvailableModel(model: AvailableModel): Promise<void> {
    return this.update(AVAILABLE_MODELS_STORE, model)
  }

  async deleteAvailableModel(id: string): Promise<void> {
    return this.delete(AVAILABLE_MODELS_STORE, id)
  }

  async deleteAvailableModelsByProvider(provider: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AVAILABLE_MODELS_STORE], 'readwrite')
      const store = transaction.objectStore(AVAILABLE_MODELS_STORE)
      const index = store.index('provider')
      const request = index.openCursor(IDBKeyRange.only(provider))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => reject(request.error)
    })
  }
}
