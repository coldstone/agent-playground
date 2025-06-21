import { SavedAPIKeys, SavedAPIEndpoints } from '@/types'

const API_KEYS_STORAGE_KEY = 'agent-playground-api-keys'
const API_ENDPOINTS_STORAGE_KEY = 'agent-playground-api-endpoints'

export class APIKeyManager {
  private static instance: APIKeyManager
  private apiKeys: SavedAPIKeys = {}
  private apiEndpoints: SavedAPIEndpoints = {}

  private constructor() {
    this.loadAPIKeys()
    this.loadAPIEndpoints()
  }

  static getInstance(): APIKeyManager {
    if (!APIKeyManager.instance) {
      APIKeyManager.instance = new APIKeyManager()
    }
    return APIKeyManager.instance
  }

  private loadAPIKeys(): void {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(API_KEYS_STORAGE_KEY)
        if (saved) {
          this.apiKeys = JSON.parse(saved)
        }
      }
    } catch (error) {
      console.error('Failed to load API keys:', error)
      this.apiKeys = {}
    }
  }

  private loadAPIEndpoints(): void {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(API_ENDPOINTS_STORAGE_KEY)
        if (saved) {
          this.apiEndpoints = JSON.parse(saved)
        }
      }
    } catch (error) {
      console.error('Failed to load API endpoints:', error)
      this.apiEndpoints = {}
    }
  }

  private saveAPIKeys(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(this.apiKeys))
      }
    } catch (error) {
      console.error('Failed to save API keys:', error)
    }
  }

  private saveAPIEndpoints(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(API_ENDPOINTS_STORAGE_KEY, JSON.stringify(this.apiEndpoints))
      }
    } catch (error) {
      console.error('Failed to save API endpoints:', error)
    }
  }

  getAPIKey(providerName: string): string {
    return this.apiKeys[providerName] || ''
  }

  setAPIKey(providerName: string, apiKey: string): void {
    if (apiKey.trim()) {
      this.apiKeys[providerName] = apiKey.trim()
    } else {
      delete this.apiKeys[providerName]
    }
    this.saveAPIKeys()
  }

  getAllAPIKeys(): SavedAPIKeys {
    return { ...this.apiKeys }
  }

  clearAPIKey(providerName: string): void {
    delete this.apiKeys[providerName]
    this.saveAPIKeys()
  }

  clearAllAPIKeys(): void {
    this.apiKeys = {}
    this.saveAPIKeys()
  }

  hasAPIKey(providerName: string): boolean {
    return Boolean(this.apiKeys[providerName])
  }

  // API Endpoints management
  getAPIEndpoint(providerName: string): string | null {
    return this.apiEndpoints[providerName] || null
  }

  setAPIEndpoint(providerName: string, endpoint: string, defaultEndpoint: string): void {
    // Only save if different from default
    if (endpoint.trim() && endpoint.trim() !== defaultEndpoint) {
      this.apiEndpoints[providerName] = endpoint.trim()
      this.saveAPIEndpoints()
    } else {
      // Remove if same as default
      delete this.apiEndpoints[providerName]
      this.saveAPIEndpoints()
    }
  }

  getAllAPIEndpoints(): SavedAPIEndpoints {
    return { ...this.apiEndpoints }
  }

  clearAPIEndpoint(providerName: string): void {
    delete this.apiEndpoints[providerName]
    this.saveAPIEndpoints()
  }

  clearAllAPIEndpoints(): void {
    this.apiEndpoints = {}
    this.saveAPIEndpoints()
  }

  hasCustomAPIEndpoint(providerName: string): boolean {
    return Boolean(this.apiEndpoints[providerName])
  }
}
