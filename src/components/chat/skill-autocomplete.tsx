'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Skill } from '@/types'
import { matchSkillPrefix } from '@/lib/skills'
import { BookOpen } from 'lucide-react'

/** Only while the whole input is still the skill name: "/pdf", not "/pdf do something". */
const PREFIX_PATTERN = /^\/([a-z0-9-]*)$/i

const NO_MATCHES: Skill[] = []

interface UseSkillAutocompleteOptions {
  value: string
  skills: Skill[]
  /** Replace the input with the completed "/name " text. */
  onComplete: (next: string) => void
}

/**
 * Minimal, dependency-free `/skill-name` autocomplete for a textarea.
 *
 * Everything is derived from `value` during render: no effect writes state, and `onComplete`
 * is read through a ref, so a caller passing a new callback identity on every render (for
 * example `setMessage` from useDraftMessage) can never drive a re-render loop here.
 *
 * `handleKeyDown` returns true when it consumed the key, so the caller must return early and
 * not send the message (Enter completes while the popover is open).
 */
export function useSkillAutocomplete({ value, skills, onComplete }: UseSkillAutocompleteOptions) {
  // Latest-callback ref: updated after every render, never a dependency of anything
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  // Selection is stored together with the prefix it belongs to, so a changed prefix resets the
  // highlight without an effect
  const [selection, setSelection] = useState<{ prefix: string; index: number }>({ prefix: '', index: 0 })
  // Escape dismisses the popover for exactly this input value; typing anything re-arms it
  const [dismissedValue, setDismissedValue] = useState<string | null>(null)

  const prefixMatch = PREFIX_PATTERN.exec(value || '')
  const prefix = prefixMatch ? prefixMatch[1] : null

  const matches = useMemo(() => (prefix === null ? NO_MATCHES : matchSkillPrefix(prefix, skills)), [prefix, skills])

  const isOpen = matches.length > 0 && dismissedValue !== value
  const activeIndex =
    selection.prefix === (prefix === null ? '' : prefix) ? Math.min(selection.index, matches.length - 1) : 0

  const complete = (skill: Skill) => {
    // The completed text ends with a space, so the popover closes on its own
    onCompleteRef.current('/' + skill.name + ' ')
    setSelection({ prefix: '', index: 0 })
  }

  const handleKeyDown = (event: React.KeyboardEvent): boolean => {
    if (!isOpen) return false

    const currentPrefix = prefix === null ? '' : prefix

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelection({ prefix: currentPrefix, index: (activeIndex + 1) % matches.length })
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelection({ prefix: currentPrefix, index: (activeIndex - 1 + matches.length) % matches.length })
      return true
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      complete(matches[Math.max(0, activeIndex)])
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setDismissedValue(value)
      return true
    }

    return false
  }

  const popover = isOpen ? (
    <div className="absolute bottom-full left-0 mb-1 w-full max-w-md z-20 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
      <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border">
        Skills — Enter or Tab to insert, Esc to dismiss
      </div>
      <div className="max-h-48 overflow-y-auto">
        {matches.map((skill, index) => (
          <button
            key={skill.id}
            type="button"
            onMouseDown={(event) => {
              // Keep the textarea focused: mousedown would otherwise blur it before the click
              event.preventDefault()
              complete(skill)
            }}
            onMouseEnter={() => setSelection({ prefix: prefix === null ? '' : prefix, index })}
            className={`w-full text-left px-3 py-2 flex items-start gap-2 ${index === activeIndex ? 'bg-muted' : 'hover:bg-muted/60'}`}
          >
            <BookOpen className="w-3.5 h-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs font-medium truncate">/{skill.name}</span>
              <span className="block text-[11px] text-muted-foreground line-clamp-1">{skill.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  ) : null

  return { isOpen, handleKeyDown, popover }
}
