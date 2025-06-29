'use client'

import React, { useState, useEffect } from 'react'
import { GanttChartSquare, SquareCode } from 'lucide-react'
import { MarkdownContent } from './markdown-content'

interface StreamingContentProps {
  content: string
  className?: string
  showToggle?: boolean
  isStreaming?: boolean
}

export function StreamingContent({ 
  content, 
  className = '', 
  showToggle = true,
  isStreaming = false 
}: StreamingContentProps) {
  const [showMarkdown, setShowMarkdown] = useState(true)
  const [displayContent, setDisplayContent] = useState('')

  // Handle streaming content with typing effect
  useEffect(() => {
    if (isStreaming) {
      setDisplayContent(content)
    } else {
      setDisplayContent(content)
    }
  }, [content, isStreaming])

  return (
    <div className={`relative ${className}`}>
      {/* Toggle Button */}
      {showToggle && (
        <button
          onClick={() => setShowMarkdown(!showMarkdown)}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors z-10 opacity-0 group-hover:opacity-100"
          title={showMarkdown ? 'Show raw text' : 'Show markdown'}
        >
          {showMarkdown ? (
            <SquareCode size={16} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <GanttChartSquare size={16} className="text-gray-600 dark:text-gray-400" />
          )}
        </button>
      )}

      {/* Content */}
      <div className="relative">
        {showMarkdown ? (
          <div className="relative">
            <MarkdownContent
              content={isStreaming ? displayContent + '█' : displayContent}
            />
          </div>
        ) : (
          <div className="relative">
            <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono text-sm leading-relaxed">
              {displayContent}
              {/* Streaming cursor for raw text */}
              {isStreaming && (
                <span className="inline-block w-2 h-5 bg-blue-500 animate-pulse" />
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
