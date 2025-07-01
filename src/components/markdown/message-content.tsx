'use client'

import React, { useState } from 'react'
import { GanttChartSquare, SquareCode } from 'lucide-react'
import { MarkdownContent } from './markdown-content'

interface MessageContentProps {
  content: string
  className?: string
  showToggle?: boolean
  toggleButton?: React.ReactNode
}

export function MessageContent({
  content,
  className = '',
  showToggle = true,
  toggleButton
}: MessageContentProps) {
  const [showMarkdown, setShowMarkdown] = useState(true)

  return (
    <div className={`relative ${className}`}>
      {/* Toggle Button - will be rendered by parent component */}
      {showToggle && toggleButton && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {toggleButton}
          <button
            onClick={() => setShowMarkdown(!showMarkdown)}
            className="h-6 w-6 p-0 flex items-center justify-center flex-shrink-0 hover:bg-muted rounded transition-colors ml-1"
            title={showMarkdown ? 'Show raw text' : 'Show markdown'}
          >
            {showMarkdown ? (
              <SquareCode className="w-3 h-3 flex-shrink-0" />
            ) : (
              <GanttChartSquare className="w-3 h-3 flex-shrink-0" />
            )}
          </button>
        </div>
      )}

      {/* Standalone toggle button when no other buttons */}
      {showToggle && !toggleButton && (
        <button
          onClick={() => setShowMarkdown(!showMarkdown)}
          className="absolute top-2 right-2 h-6 w-6 p-0 flex items-center justify-center flex-shrink-0 hover:bg-muted rounded transition-colors z-10 opacity-0 group-hover:opacity-100"
          title={showMarkdown ? 'Show raw text' : 'Show markdown'}
        >
          {showMarkdown ? (
            <SquareCode className="w-3 h-3 flex-shrink-0" />
          ) : (
            <GanttChartSquare className="w-3 h-3 flex-shrink-0" />
          )}
        </button>
      )}

      {/* Content */}
      {showMarkdown ? (
        <MarkdownContent content={content} />
      ) : (
        <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono text-sm leading-relaxed">
          {content}
        </pre>
      )}
    </div>
  )
}
