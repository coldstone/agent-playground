import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

export interface CustomSelectProps {
  value?: string
  placeholder?: string
  options?: SelectOption[]
  groups?: SelectGroup[]
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  width?: string
}

export function CustomSelect({
  value,
  placeholder = 'Select an option',
  options = [],
  groups = [],
  onChange,
  disabled = false,
  className = '',
  size = 'md',
  width = 'w-full'
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [keyboardNavigation, setKeyboardNavigation] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Flatten all options for keyboard navigation
  const allOptions = groups.length > 0 
    ? groups.flatMap(group => group.options)
    : options

  const selectedOption = allOptions.find(option => option.value === value)

  // Size classes
  const sizeClasses = {
    xs: 'h-6 text-xs px-2',
    sm: 'h-8 text-sm px-2',
    md: 'h-10 text-sm px-3',
    lg: 'h-12 text-base px-4'
  }

  const dropdownSizeClasses = {
    xs: 'text-xs py-1',
    sm: 'text-sm py-1',
    md: 'text-sm py-1.5',
    lg: 'text-base py-2'
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation - only listen when dropdown is open
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Only handle keyboard events when dropdown is open
      if (!isOpen) return



      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setKeyboardNavigation(true)
          setHighlightedIndex(prev => {
            return prev === -1 ? 0 : (prev < allOptions.length - 1 ? prev + 1 : 0)
          })
          break
        case 'ArrowUp':
          event.preventDefault()
          setKeyboardNavigation(true)
          setHighlightedIndex(prev => {
            return prev === -1 ? allOptions.length - 1 : (prev > 0 ? prev - 1 : allOptions.length - 1)
          })
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
            const option = allOptions[highlightedIndex]
            if (!option.disabled) {
              onChange?.(option.value)
              setIsOpen(false)
              setHighlightedIndex(-1)
              setKeyboardNavigation(false)
            }
          }
          break
        case 'Escape':
          event.preventDefault()
          setIsOpen(false)
          setHighlightedIndex(-1)
          setKeyboardNavigation(false)
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, highlightedIndex, allOptions, onChange])

  // Scroll highlighted option into view (only for keyboard navigation)
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && keyboardNavigation && listRef.current) {
      // Find the actual option element by traversing the DOM structure
      const findOptionElement = (container: HTMLElement, targetIndex: number): HTMLElement | null => {
        let currentIndex = 0

        const traverse = (element: HTMLElement): HTMLElement | null => {
          for (const child of Array.from(element.children)) {
            const htmlChild = child as HTMLElement

            // Check if this is an option element (has onClick handler)
            if (htmlChild.onclick || htmlChild.getAttribute('data-option-index')) {
              if (currentIndex === targetIndex) {
                return htmlChild
              }
              currentIndex++
            } else {
              // Recursively search in child elements
              const found = traverse(htmlChild)
              if (found) return found
            }
          }
          return null
        }

        return traverse(container)
      }

      const highlightedElement = findOptionElement(listRef.current, highlightedIndex)
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'auto' // Use 'auto' instead of 'smooth' to avoid conflicts
        })
      }
    }
  }, [highlightedIndex, isOpen, keyboardNavigation])

  const handleToggle = () => {
    if (!disabled) {
      const newIsOpen = !isOpen
      setIsOpen(newIsOpen)
      setKeyboardNavigation(false)

      if (newIsOpen) {
        // When opening, set highlighted index to current selection or first option
        const currentIndex = value ? allOptions.findIndex(option => option.value === value) : -1
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)

        // Focus the select element for keyboard navigation
        setTimeout(() => {
          selectRef.current?.focus()
        }, 0)
      } else {
        setHighlightedIndex(-1)
      }
    }
  }

  const handleOptionClick = (option: SelectOption) => {
    if (!option.disabled) {
      onChange?.(option.value)
      setIsOpen(false)
      setHighlightedIndex(-1)
      setKeyboardNavigation(false)
    }
  }

  const renderOption = (option: SelectOption, index: number) => {
    const isSelected = option.value === value
    const isHighlighted = index === highlightedIndex

    return (
      <div
        key={option.value}
        data-option-index={index}
        className={`
          cursor-pointer px-3 py-2 flex items-center justify-between
          ${dropdownSizeClasses[size]}
          ${isHighlighted ? 'bg-accent text-accent-foreground' : ''}
          ${isSelected ? 'bg-primary/10 text-primary' : ''}
          ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent hover:text-accent-foreground'}
        `}
        onClick={() => handleOptionClick(option)}
        onMouseEnter={() => {
          if (!option.disabled) {
            setKeyboardNavigation(false)
            setHighlightedIndex(index)
          }
        }}
        onMouseLeave={() => {
          if (!keyboardNavigation) {
            setHighlightedIndex(-1)
          }
        }}
      >
        <span className={option.disabled ? 'text-muted-foreground' : ''}>
          {option.label}
        </span>
        {isSelected && <Check className="w-4 h-4" />}
      </div>
    )
  }

  return (
    <div ref={selectRef} className={`relative ${width} ${className}`}>
      {/* Trigger */}
      <div
        className={`
          ${sizeClasses[size]}
          ${width}
          border border-input bg-background
          rounded-md cursor-pointer flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent hover:text-accent-foreground'}
          ${isOpen ? 'ring-2 ring-ring ring-offset-2' : ''}
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        `}
        onClick={handleToggle}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          // Only handle Enter/Space when dropdown is closed
          // When dropdown is open, let the global keyboard handler deal with it
          if (!isOpen && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            handleToggle()
          }
        }}
        onFocus={() => {
          // Ensure the component can receive keyboard events
        }}
      >
        <span className={selectedOption ? '' : 'text-muted-foreground'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="fixed z-[9999] w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto"
          style={(() => {
            if (!selectRef.current) return {}
            
            const rect = selectRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            const spaceAbove = rect.top
            const shouldDropUp = spaceBelow < 120 && spaceAbove > spaceBelow
            
            // 估算实际内容高度（选项数量 * 大概高度）
            const optionCount = groups.length > 0 
              ? groups.reduce((acc, g) => acc + g.options.length, 0)
              : options.length
            const estimatedHeight = Math.min(optionCount * 40 + 16, 240) // 每个选项约40px高度，最大240px
            
            return {
              top: shouldDropUp 
                ? rect.top - estimatedHeight + 22
                : rect.bottom + 2,
              left: rect.left,
              width: rect.width,
              maxHeight: shouldDropUp ? Math.min(240, spaceAbove - 8) : Math.min(240, spaceBelow - 8)
            }
          })()}
          onMouseEnter={() => setKeyboardNavigation(false)}
        >
          <div>
            {groups.length > 0 ? (
              // Render grouped options
              groups.map((group, groupIndex) => (
                <div key={group.label}>
                  {groupIndex > 0 && <div className="border-t border-border" />}
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                    {group.label}
                  </div>
                  {group.options.map((option, optionIndex) => {
                    const globalIndex = groups
                      .slice(0, groupIndex)
                      .reduce((acc, g) => acc + g.options.length, 0) + optionIndex
                    return renderOption(option, globalIndex)
                  })}
                </div>
              ))
            ) : (
              // Render flat options
              options.map((option, index) => renderOption(option, index))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
