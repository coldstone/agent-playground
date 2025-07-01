'use client'

import React, { useRef, useEffect, useCallback, useMemo } from 'react'
import { scrollManager } from '@/lib/scroll-manager'

interface StableTableContainerProps {
  children: React.ReactNode
  tableId?: string
}

const StableTableContainerComponent = function StableTableContainer({ children, tableId }: StableTableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useRef(tableId || `table-${Math.random().toString(36).substr(2, 9)}`)
  const isScrollingRef = useRef(false)

  // 处理滚动事件
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement
    if (target && !isScrollingRef.current) {
      scrollManager.saveScrollPosition(id.current, target.scrollLeft)
    }
  }, [])

  // 恢复滚动位置
  const restoreScroll = useCallback(() => {
    if (containerRef.current) {
      isScrollingRef.current = true
      scrollManager.restoreScrollPosition(containerRef.current, id.current)
      
      // 短暂延迟后允许正常滚动
      setTimeout(() => {
        isScrollingRef.current = false
      }, 100)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      // 添加滚动监听
      container.addEventListener('scroll', handleScroll, { passive: true })
      
      // 开始观察元素变化
      scrollManager.observeElement(container, id.current)
      
      // 初始恢复滚动位置
      restoreScroll()

      return () => {
        container.removeEventListener('scroll', handleScroll)
        scrollManager.unobserveElement(id.current)
      }
    }
  }, [handleScroll, restoreScroll])

  // 在每次重新渲染后恢复滚动位置
  useEffect(() => {
    restoreScroll()
  })

  // 缓存样式对象，避免每次重新创建
  const containerStyle = useMemo(() => ({
    overflowX: 'auto' as const,
    overflowY: 'visible' as const,
    maxWidth: '100%',
    width: '100%',
    // 关键：防止布局重新计算
    contain: 'layout style size' as const,
    // 创建新的层叠上下文
    transform: 'translateZ(0)',
    // 优化滚动性能
    WebkitOverflowScrolling: 'touch' as const,
    scrollbarWidth: 'thin' as const,
    // 确保容器稳定
    position: 'relative' as const,
    boxSizing: 'border-box' as const,
    // 防止意外的样式重置
    minHeight: 'min-content' as const
  }), [])

  return (
    <div
      ref={containerRef}
      className="stable-table-container my-4 border border-gray-300 dark:border-gray-600 rounded-lg"
      style={containerStyle}
    >
      {children}
    </div>
  )
}

// 使用 React.memo 包装组件，避免不必要的重新渲染
export const StableTableContainer = React.memo(StableTableContainerComponent)
