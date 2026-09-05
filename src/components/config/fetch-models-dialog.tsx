'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Loader2, RefreshCw, Search } from 'lucide-react'

interface FetchModelsDialogProps {
  isOpen: boolean
  providerName: string
  /** Models currently configured for the provider (used to pre-check items) */
  currentModels: string[]
  /** Loads the remote model list; should throw on failure */
  onFetch: () => Promise<string[]>
  /** Called with the fetched list and the checked subset */
  onApply: (fetchedModels: string[], checkedModels: string[]) => Promise<void>
  onClose: () => void
}

export function FetchModelsDialog({
  isOpen,
  providerName,
  currentModels,
  onFetch,
  onApply,
  onClose
}: FetchModelsDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const loadModels = async () => {
    setIsLoading(true)
    setError('')
    try {
      const models = await onFetch()
      setFetchedModels(models)
      // Pre-check models that are already part of the provider's list
      setChecked(new Set(models.filter((m) => currentModels.includes(m))))
    } catch (err) {
      setFetchedModels([])
      setChecked(new Set())
      setError(err instanceof Error ? err.message : 'Failed to fetch models')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch whenever the dialog opens
  useEffect(() => {
    if (isOpen) {
      setFilter('')
      loadModels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const filteredModels = useMemo(() => {
    const keyword = filter.trim().toLowerCase()
    if (!keyword) return fetchedModels
    return fetchedModels.filter((m) => m.toLowerCase().includes(keyword))
  }, [fetchedModels, filter])

  const toggle = (model: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(model)) {
        next.delete(model)
      } else {
        next.add(model)
      }
      return next
    })
  }

  const selectFiltered = () => {
    setChecked((prev) => {
      const next = new Set(prev)
      filteredModels.forEach((m) => next.add(m))
      return next
    })
  }

  const clearFiltered = () => {
    setChecked((prev) => {
      const next = new Set(prev)
      filteredModels.forEach((m) => next.delete(m))
      return next
    })
  }

  const handleApply = async () => {
    setIsSaving(true)
    try {
      await onApply(fetchedModels, fetchedModels.filter((m) => checked.has(m)))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save models')
    } finally {
      setIsSaving(false)
    }
  }

  const allFilteredChecked = filteredModels.length > 0 && filteredModels.every((m) => checked.has(m))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Fetch Models from ${providerName}`} size="md">
      <ModalBody className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter models..."
              className="pl-8"
              disabled={isLoading}
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadModels} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-900 break-all">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {isLoading
              ? 'Loading...'
              : `${checked.size} selected / ${fetchedModels.length} fetched${filter ? ` (${filteredModels.length} shown)` : ''}`}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-0.5 text-xs"
              onClick={allFilteredChecked ? clearFiltered : selectFiltered}
              disabled={isLoading || filteredModels.length === 0}
            >
              {allFilteredChecked ? 'Clear' : 'Select all'}
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-md max-h-[50vh] min-h-[10rem] overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Fetching model list...
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              {fetchedModels.length === 0 ? 'No models fetched' : 'No models match the filter'}
            </div>
          ) : (
            filteredModels.map((model) => (
              <label key={model} className="flex items-center space-x-2 cursor-pointer py-1 px-1 rounded hover:bg-muted/60">
                <input
                  type="checkbox"
                  checked={checked.has(model)}
                  onChange={() => toggle(model)}
                  className="apg-checkbox"
                />
                <span className="text-sm break-all">{model}</span>
                {currentModels.includes(model) && (
                  <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">in list</span>
                )}
              </label>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Checked models replace the fetched ones in the provider's model list. Newly added models are enabled automatically;
          models added by hand that were not returned by the API are kept.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleApply} disabled={isLoading || isSaving || fetchedModels.length === 0}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
          Apply
        </Button>
      </ModalFooter>
    </Modal>
  )
}
