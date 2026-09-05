'use client'

import React, { useMemo, useState } from 'react'
import { MCPElicitationRequest, MCPElicitResult } from '@/types'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CustomSelect } from '@/components/ui/custom-select'
import { ExternalLink } from 'lucide-react'

interface MCPElicitationModalProps {
  request: MCPElicitationRequest | null
  serverName?: string
  onRespond: (result: MCPElicitResult) => void
}

type PrimitiveSchema = {
  type?: string
  title?: string
  description?: string
  enum?: unknown[]
  enumNames?: string[]
  oneOf?: Array<{ const: unknown; title?: string }>
  items?: { type?: string; enum?: unknown[]; enumNames?: string[]; oneOf?: Array<{ const: unknown; title?: string }> }
  default?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  format?: string
  [key: string]: unknown
}

interface FieldDef {
  name: string
  schema: PrimitiveSchema
  required: boolean
}

function enumOptions(schema: PrimitiveSchema | undefined): { value: string; label: string }[] {
  if (!schema) return []
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((o) => ({ value: String(o.const), label: o.title || String(o.const) }))
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((v, i) => ({ value: String(v), label: schema.enumNames?.[i] || String(v) }))
  }
  return []
}

function initialValues(fields: FieldDef[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.schema.default !== undefined) {
      values[field.name] = field.schema.default
    } else if (field.schema.type === 'boolean') {
      values[field.name] = false
    } else if (field.schema.type === 'array') {
      values[field.name] = []
    } else {
      values[field.name] = ''
    }
  }
  return values
}

/**
 * Renders an MCP elicitation request (form mode: a flat object of primitive fields,
 * url mode: an out-of-band link) and reports the user's decision.
 */
export function MCPElicitationModal({ request, serverName, onRespond }: MCPElicitationModalProps) {
  const fields = useMemo<FieldDef[]>(() => {
    const schema = request?.requestedSchema
    if (!schema || typeof schema !== 'object') return []
    const required: string[] = Array.isArray(schema.required) ? schema.required : []
    return Object.entries((schema.properties || {}) as Record<string, PrimitiveSchema>).map(([name, def]) => ({
      name,
      schema: def || {},
      required: required.includes(name)
    }))
  }, [request])

  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(fields))
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form state whenever a new request arrives
  const requestId = request?.id
  const [seenId, setSeenId] = useState(requestId)
  if (requestId !== seenId) {
    setSeenId(requestId)
    setValues(initialValues(fields))
    setErrors({})
  }

  if (!request) return null

  const setValue = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const validate = (): Record<string, unknown> | null => {
    const content: Record<string, unknown> = {}
    const nextErrors: Record<string, string> = {}

    for (const field of fields) {
      const raw = values[field.name]
      const type = field.schema.type
      const isEmpty = raw === '' || raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)

      if (isEmpty) {
        if (field.required) nextErrors[field.name] = 'Required'
        continue
      }

      if (type === 'number' || type === 'integer') {
        const num = Number(raw)
        if (Number.isNaN(num) || (type === 'integer' && !Number.isInteger(num))) {
          nextErrors[field.name] = type === 'integer' ? 'Must be an integer' : 'Must be a number'
          continue
        }
        if (field.schema.minimum !== undefined && num < field.schema.minimum) {
          nextErrors[field.name] = `Must be >= ${field.schema.minimum}`
          continue
        }
        if (field.schema.maximum !== undefined && num > field.schema.maximum) {
          nextErrors[field.name] = `Must be <= ${field.schema.maximum}`
          continue
        }
        content[field.name] = num
      } else if (type === 'boolean') {
        content[field.name] = Boolean(raw)
      } else if (type === 'array') {
        content[field.name] = Array.isArray(raw) ? raw : [raw]
      } else {
        const str = String(raw)
        if (field.schema.minLength !== undefined && str.length < field.schema.minLength) {
          nextErrors[field.name] = `At least ${field.schema.minLength} characters`
          continue
        }
        if (field.schema.maxLength !== undefined && str.length > field.schema.maxLength) {
          nextErrors[field.name] = `At most ${field.schema.maxLength} characters`
          continue
        }
        content[field.name] = str
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0 ? content : null
  }

  const handleAccept = () => {
    if (request.mode === 'url') {
      onRespond({ action: 'accept' })
      return
    }
    const content = validate()
    if (content) onRespond({ action: 'accept', content })
  }

  const renderField = (field: FieldDef) => {
    const { name, schema } = field
    const label = schema.title || name
    const options = enumOptions(schema)
    const itemOptions = enumOptions(schema.items as PrimitiveSchema | undefined)
    const value = values[name]
    const error = errors[name]

    let control: React.ReactNode
    if (schema.type === 'boolean') {
      control = (
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" className="apg-checkbox" checked={Boolean(value)} onChange={(e) => setValue(name, e.target.checked)} />
          <span>{schema.description || label}</span>
        </label>
      )
    } else if (schema.type === 'array' && itemOptions.length > 0) {
      const selected = Array.isArray(value) ? value.map(String) : []
      control = (
        <div className="space-y-1">
          {itemOptions.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                className="apg-checkbox"
                checked={selected.includes(opt.value)}
                onChange={(e) =>
                  setValue(name, e.target.checked ? [...selected, opt.value] : selected.filter((v) => v !== opt.value))
                }
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )
    } else if (options.length > 0) {
      control = (
        <CustomSelect
          value={value === undefined || value === null ? '' : String(value)}
          placeholder="Select..."
          options={options}
          onChange={(v) => setValue(name, v)}
        />
      )
    } else if (schema.type === 'number' || schema.type === 'integer') {
      control = (
        <Input
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          min={schema.minimum}
          max={schema.maximum}
          step={schema.type === 'integer' ? 1 : 'any'}
          onChange={(e) => setValue(name, e.target.value)}
        />
      )
    } else if ((schema.maxLength && schema.maxLength > 200) || schema.format === 'multiline') {
      control = <Textarea rows={3} value={String(value ?? '')} onChange={(e) => setValue(name, e.target.value)} />
    } else {
      control = (
        <Input
          type={schema.format === 'email' ? 'email' : schema.format === 'uri' ? 'url' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => setValue(name, e.target.value)}
        />
      )
    }

    return (
      <div key={name} className="space-y-1">
        {schema.type !== 'boolean' && (
          <Label>
            {label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        {control}
        {schema.type !== 'boolean' && schema.description && (
          <p className="text-xs text-muted-foreground">{schema.description}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <Modal
      isOpen={true}
      onClose={() => onRespond({ action: 'cancel' })}
      title={serverName ? `${serverName} needs your input` : 'MCP server needs your input'}
      size="md"
    >
      <ModalBody className="space-y-4">
        <p className="text-sm whitespace-pre-wrap">{request.message}</p>

        {request.mode === 'url' ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Open the link below, complete the interaction, then come back and press Continue.
            </p>
            {request.url && (
              <a
                href={request.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline break-all"
              >
                <ExternalLink className="w-4 h-4" />
                {request.url}
              </a>
            )}
          </div>
        ) : fields.length > 0 ? (
          <div className="space-y-3">{fields.map(renderField)}</div>
        ) : (
          <p className="text-xs text-muted-foreground">No additional details are requested. Press Accept to confirm.</p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={() => onRespond({ action: 'cancel' })}>
          Cancel
        </Button>
        <Button variant="outline" onClick={() => onRespond({ action: 'decline' })}>
          Decline
        </Button>
        <Button onClick={handleAccept}>{request.mode === 'url' ? 'Continue' : 'Accept'}</Button>
      </ModalFooter>
    </Modal>
  )
}
