'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

interface UseSmartScrollOptions {
  /**
   * 触发自动滚动的依赖项
   */
  dependencies: any[]
  /**
   * 滚动容器的引用
   */
  containerRef: React.RefObject<HTMLElement>
  /**
   * 检测用户是否接近底部的阈值（像素）
   */
  threshold?: number
  /**
   * 是否正在流式输出
   */
  isStreaming?: boolean
  /**
   * 强制滚动到底部的触发器
   */
  forceScrollTrigger?: number
}

export function useSmartScroll({
  dependencies,
  containerRef,
  threshold = 100,
  isStreaming = false,
  forceScrollTrigger
}: UseSmartScrollOptions) {
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const lastScrollTopRef = useRef(0)
  const scrollDebounceRef = useRef<NodeJS.Timeout>()
  const isScrollingToBottomRef = useRef(false)

  // 检查是否接近底部
  const isNearBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return false
    
    const { scrollTop, scrollHeight, clientHeight } = container
    return scrollHeight - scrollTop - clientHeight <= threshold
  }, [threshold, containerRef])

  // 滚动到底部（带防抖）
  const scrollToBottom = useCallback((useSmooth = true) => {
    const container = containerRef.current
    if (!container || !isAutoScrollEnabled || isScrollingToBottomRef.current) return

    // 清除之前的防抖
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current)
    }

    // 防抖执行滚动
    scrollDebounceRef.current = setTimeout(() => {
      if (!container || !isAutoScrollEnabled) return

      isScrollingToBottomRef.current = true

      container.scrollTo({
        top: container.scrollHeight,
        behavior: useSmooth ? 'smooth' : 'auto'
      })

      // 滚动完成后重置标志
      setTimeout(() => {
        isScrollingToBottomRef.current = false
      }, useSmooth ? 300 : 50)
    }, 16) // 约一帧的时间
  }, [isAutoScrollEnabled, containerRef])

  // 处理用户滚动事件
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || isScrollingToBottomRef.current) return

    const currentScrollTop = container.scrollTop
    const scrollDirection = currentScrollTop > lastScrollTopRef.current ? 'down' : 'up'
    lastScrollTopRef.current = currentScrollTop

    // 设置用户正在滚动的状态
    setIsUserScrolling(true)

    // 清除之前的超时
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    // 500ms后认为用户停止滚动
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false)
    }, 500)

    // 检查滚动方向和位置
    if (scrollDirection === 'up') {
      // 用户向上滚动，禁用自动滚动
      setIsAutoScrollEnabled(false)
    } else if (scrollDirection === 'down' && isNearBottom()) {
      // 用户向下滚动且接近底部，启用自动滚动
      setIsAutoScrollEnabled(true)
    }
  }, [isNearBottom, containerRef])

  // 监听滚动事件
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }
    }
  }, [handleScroll, containerRef])

  // 当依赖项变化时，如果启用了自动滚动，则滚动到底部
  useEffect(() => {
    if (isAutoScrollEnabled && !isUserScrolling) {
      // 始终使用smooth滚动，避免切换滚动模式导致的跳动
      scrollToBottom(true)
    }
  }, [...dependencies, isAutoScrollEnabled, isUserScrolling])

  // 处理强制滚动触发器（用户发送消息时）
  useEffect(() => {
    if (forceScrollTrigger !== undefined) {
      // 强制启用自动滚动并立即滚动到底部
      setIsAutoScrollEnabled(true)
      setIsUserScrolling(false)

      // 立即滚动到底部，不使用防抖
      const container = containerRef.current
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
  }, [forceScrollTrigger, containerRef])

  // 初始化时滚动到底部
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      // 初始时直接滚动到底部，不使用动画
      container.scrollTop = container.scrollHeight
    }
  }, [containerRef])

  return {
    isAutoScrollEnabled,
    isUserScrolling,
    scrollToBottom: () => {
      setIsAutoScrollEnabled(true)
      scrollToBottom(true)
    },
    forceScrollToBottom: () => {
      const container = containerRef.current
      if (container) {
        setIsAutoScrollEnabled(true)
        isScrollingToBottomRef.current = true
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        })
        setTimeout(() => {
          isScrollingToBottomRef.current = false
        }, 300)
      }
    }
  }
}
