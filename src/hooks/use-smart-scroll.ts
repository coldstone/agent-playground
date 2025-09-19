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
   * 强制滚动到底部的触发器（立即跳转，无动画）
   */
  forceScrollTrigger?: number
  /**
   * 平滑滚动到底部的触发器（用于用户发送消息）
   */
  scrollToBottomTrigger?: number
}

export function useSmartScroll({
  dependencies,
  containerRef,
  threshold = 100,
  isStreaming = false,
  forceScrollTrigger,
  scrollToBottomTrigger
}: UseSmartScrollOptions) {
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const lastScrollTopRef = useRef(0)
  const scrollDebounceRef = useRef<NodeJS.Timeout>()
  const isScrollingToBottomRef = useRef(false)
  const wasStreamingRef = useRef(false)
  const userManuallyLeftBottomDuringStreamingRef = useRef(false) // 用户在流式输出期间是否手动离开了底部

  // 检查是否接近底部
  const isNearBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return false
    
    const { scrollTop, scrollHeight, clientHeight } = container
    return scrollHeight - scrollTop - clientHeight <= threshold
  }, [threshold, containerRef])

  // 滚动到底部（带防抖）
  const scrollToBottom = useCallback((useSmooth = true, forceScroll = false) => {
    const container = containerRef.current
    if (!container || (!isAutoScrollEnabled && !forceScroll) || isScrollingToBottomRef.current) return

    // 如果用户在流式输出期间手动离开了底部，则不执行自动滚动
    if (isStreaming && userManuallyLeftBottomDuringStreamingRef.current && !forceScroll) {
      return
    }

    // 清除之前的防抖
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current)
    }

    // 防抖执行滚动
    scrollDebounceRef.current = setTimeout(() => {
      if (!container || (!isAutoScrollEnabled && !forceScroll)) return

      // 再次检查用户是否手动离开了底部
      if (isStreaming && userManuallyLeftBottomDuringStreamingRef.current && !forceScroll) {
        return
      }

      isScrollingToBottomRef.current = true

      // 使用requestAnimationFrame确保DOM更新完成后再滚动
      requestAnimationFrame(() => {
        if (!container) return
        const scrollTop = container.scrollHeight - container.clientHeight
        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: useSmooth ? 'smooth' : 'auto'
        })
      })

      // 滚动完成后重置标志
      setTimeout(() => {
        isScrollingToBottomRef.current = false
      }, useSmooth ? 300 : 50)
    }, 16) // 约一帧的时间
  }, [isAutoScrollEnabled, containerRef, isStreaming])

  // 滚动到顶部
  const scrollToTop = useCallback((useSmooth = true) => {
    const container = containerRef.current
    if (!container) return

    container.scrollTo({
      top: 0,
      behavior: useSmooth ? 'smooth' : 'auto'
    })
  }, [containerRef])

  // 处理用户滚动事件
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || isScrollingToBottomRef.current) return

    const currentScrollTop = container.scrollTop
    const scrollDirection = currentScrollTop > lastScrollTopRef.current ? 'down' : 'up'
    lastScrollTopRef.current = currentScrollTop

    // 检查是否接近底部
    const nearBottom = isNearBottom()

    // 检查是否远离顶部
    const farFromTop = currentScrollTop > threshold

    // 更新滚动到底部按钮的显示状态
    setShowScrollToBottom(!nearBottom)

    // 更新滚动到顶部按钮的显示状态
    setShowScrollToTop(farFromTop)

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

    // 特殊处理流式输出期间的滚动行为
    if (isStreaming) {
      // 用户向上滚动，判断是否真的想离开底部
      if (scrollDirection === 'up') {
        const { scrollTop, scrollHeight, clientHeight } = container
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight

        // 只有当用户向上滚动超过阈值距离时，才认为是有意离开底部
        if (distanceFromBottom > threshold * 2) { // 使用更大的阈值确保是有意滚动
          userManuallyLeftBottomDuringStreamingRef.current = true
          setIsAutoScrollEnabled(false)

          // 清除任何待执行的自动滚动
          if (scrollDebounceRef.current) {
            clearTimeout(scrollDebounceRef.current)
          }
        }
      } else if (scrollDirection === 'down' && nearBottom) {
        // 用户重新滚动回底部，恢复自动滚动
        userManuallyLeftBottomDuringStreamingRef.current = false
        setIsAutoScrollEnabled(true)
      }
    } else {
      // 非流式输出期间的原有逻辑
      if (scrollDirection === 'up') {
        // 用户向上滚动，只有当滚动距离足够大时才禁用自动滚动
        // 这样可以避免微小的滚动变化影响自动跟随
        const { scrollTop, scrollHeight, clientHeight } = container
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight
        if (distanceFromBottom > threshold) {
          setIsAutoScrollEnabled(false)
        }
      } else if (scrollDirection === 'down' && nearBottom) {
        // 用户向下滚动且接近底部，启用自动滚动
        setIsAutoScrollEnabled(true)
      }
    }
  }, [isNearBottom, containerRef, threshold, isStreaming])

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
    // 检查是否从流式输出状态变为非流式输出状态
    const justStoppedStreaming = wasStreamingRef.current && !isStreaming

    // 检查是否刚开始流式输出
    const justStartedStreaming = !wasStreamingRef.current && isStreaming

    wasStreamingRef.current = isStreaming

    // 如果刚刚停止流式输出，重置手动离开标志，不做滚动操作，保持当前位置
    if (justStoppedStreaming) {
      userManuallyLeftBottomDuringStreamingRef.current = false
      return
    }

    // 如果刚开始流式输出，重置手动离开标志
    if (justStartedStreaming) {
      userManuallyLeftBottomDuringStreamingRef.current = false
    }

    // 在流式输出过程中需要保持滚动到底部
    if (isStreaming && isAutoScrollEnabled && !userManuallyLeftBottomDuringStreamingRef.current) {
      // 对于流式内容，使用更短的防抖延迟来实现更流畅的跟随
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }

      scrollDebounceRef.current = setTimeout(() => {
        // 在执行滚动前再次确认用户没有手动离开底部
        if (!userManuallyLeftBottomDuringStreamingRef.current) {
          scrollToBottom(false) // 使用instant滚动，避免smooth动画与流式内容冲突
        }
      }, 50) // 增加延迟，给用户滚动操作更多时间
    }
    // 如果内容高度发生变化但不是在流式输出，仍然需要调整滚动位置
    else if (!isStreaming && isAutoScrollEnabled && !isUserScrolling) {
      // 使用更长的延迟，让DOM渲染完成
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }
      scrollDebounceRef.current = setTimeout(() => {
        scrollToBottom(true) // 非流式状态使用smooth滚动
      }, 50) // 给DOM更多时间渲染
    }
  }, [...dependencies, isAutoScrollEnabled, isUserScrolling, isStreaming])

  // 处理强制滚动触发器（会话切换时立即跳转）
  useEffect(() => {
    if (forceScrollTrigger !== undefined) {
      // 强制启用自动滚动并立即滚动到底部
      setIsAutoScrollEnabled(true)
      setIsUserScrolling(false)
      setShowScrollToTop(false)

      // 重置手动离开标志
      userManuallyLeftBottomDuringStreamingRef.current = false

      // 清除之前记录的滚动位置，进入自动跟随模式
      lastScrollTopRef.current = 0

      // 立即滚动到底部，不使用防抖和动画
      const container = containerRef.current
      if (container) {
        // 直接设置scrollTop，实现立即跳转
        container.scrollTop = container.scrollHeight
      }
    }
  }, [forceScrollTrigger, containerRef])

  // 处理平滑滚动触发器（用户发送消息时）
  useEffect(() => {
    if (scrollToBottomTrigger !== undefined && scrollToBottomTrigger > 0) {
      // 强制启用自动滚动并平滑滚动到底部
      setIsAutoScrollEnabled(true)
      setIsUserScrolling(false)
      setShowScrollToBottom(false)
      setShowScrollToTop(false)

      // 重置手动离开标志
      userManuallyLeftBottomDuringStreamingRef.current = false

      // 清除之前记录的滚动位置，进入自动跟随模式
      lastScrollTopRef.current = 0

      // 平滑滚动到底部
      const container = containerRef.current
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
  }, [scrollToBottomTrigger, containerRef])

  // 初始化时滚动到底部
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      // 初始时直接滚动到底部，不使用动画
      container.scrollTop = container.scrollHeight
      setShowScrollToBottom(false)
      setShowScrollToTop(false)
    }
  }, [containerRef])

  return {
    isAutoScrollEnabled,
    isUserScrolling,
    showScrollToBottom,
    showScrollToTop,
    scrollToBottom: () => {
      setIsAutoScrollEnabled(true)
      setShowScrollToBottom(false)
      userManuallyLeftBottomDuringStreamingRef.current = false // 重置手动离开标志
      scrollToBottom(true)
    },
    scrollToTop: () => {
      setShowScrollToTop(false)
      scrollToTop(true)
    },
    forceScrollToBottom: () => {
      const container = containerRef.current
      if (container) {
        setIsAutoScrollEnabled(true)
        setShowScrollToBottom(false)
        userManuallyLeftBottomDuringStreamingRef.current = false // 重置手动离开标志
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
