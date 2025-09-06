'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'agent-playground-code-wrap'

export function useCodeWrap() {
  const [isWrapEnabled, setIsWrapEnabled] = useState(false)

  useEffect(() => {
    // 从localStorage读取设置
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setIsWrapEnabled(stored === 'true')
    }
  }, [])

  const toggleWrap = () => {
    const newValue = !isWrapEnabled
    setIsWrapEnabled(newValue)
    localStorage.setItem(STORAGE_KEY, String(newValue))
  }

  return {
    isWrapEnabled,
    toggleWrap
  }
}