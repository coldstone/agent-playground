import React from 'react'
import Image from 'next/image'

export function Title() {
  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.svg"
          alt="Agent Playground Logo"
          width={32}
          height={32}
          className="flex-shrink-0"
        />
        <h1 className="text-lg font-semibold text-foreground">Agent Playground</h1>
      </div>
      <p className="text-xs text-muted-foreground mt-2 ml-1">Try and see how the AI agent works</p>
    </div>
  )
}
