'use client'

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'

interface UseSmartScrollOptions {
  /**
   * Dependencies that trigger an auto-scroll when they change
   */
  dependencies: any[]
  /**
   * Ref of the scroll container
   */
  containerRef: React.RefObject<HTMLElement>
  /**
   * Distance (px) from the bottom that still counts as "at the bottom"
   */
  threshold?: number
  /**
   * Whether the assistant is currently streaming
   */
  isStreaming?: boolean
  /**
   * Trigger for an immediate jump to the bottom (session switch), no animation
   */
  forceScrollTrigger?: number
  /**
   * Trigger for a smooth scroll to the bottom (user sent a message)
   */
  scrollToBottomTrigger?: number
}

// useLayoutEffect warns during server rendering; this component tree only scrolls in the browser
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// How many frames the bottom stays pinned after a stream ends. The persisted message that
// replaces the streaming block (with its reasoning collapsed) can land one or two commits
// later, so a single scroll on the flip is not enough.
const STREAM_END_PIN_FRAMES = 12

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
  const wasStreamingLayoutRef = useRef(false)
  const userManuallyLeftBottomDuringStreamingRef = useRef(false) // User deliberately left the bottom while streaming
  const followSuspendedRef = useRef(false) // User took over the scroll during the current stream
  const isAutoScrollEnabledRef = useRef(true) // Mirror of the state, readable from the rAF loop
  const programmaticTopRef = useRef(-1) // Last scrollTop this hook wrote itself
  const previousProgrammaticTopRef = useRef(-1) // The one before it: scroll events can lag a frame behind
  const pinRafRef = useRef<number>()

  // Always go through this so the rAF follow loop and the scroll listener see the new value
  // in the same tick instead of waiting for the next render.
  const setAutoScrollEnabled = useCallback((enabled: boolean) => {
    isAutoScrollEnabledRef.current = enabled
    setIsAutoScrollEnabled(enabled)
  }, [])

  // Whether the bottom should currently be followed
  const shouldFollowBottom = useCallback(
    () =>
      isAutoScrollEnabledRef.current &&
      !userManuallyLeftBottomDuringStreamingRef.current &&
      !followSuspendedRef.current,
    []
  )

  // Check whether the container is close enough to the bottom
  const isNearBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return false

    const { scrollTop, scrollHeight, clientHeight } = container
    return scrollHeight - scrollTop - clientHeight <= threshold
  }, [threshold, containerRef])

  // Put the container at the bottom instantly and remember the position we wrote, so the
  // scroll listener can tell this scroll apart from one the user performed.
  const pinToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const target = Math.max(0, container.scrollHeight - container.clientHeight)
    if (target !== programmaticTopRef.current) {
      previousProgrammaticTopRef.current = programmaticTopRef.current
      programmaticTopRef.current = target
    }
    if (Math.abs(container.scrollTop - target) > 1) {
      container.scrollTop = target
    }
  }, [containerRef])

  const cancelPinLoop = useCallback(() => {
    if (pinRafRef.current !== undefined) {
      cancelAnimationFrame(pinRafRef.current)
      pinRafRef.current = undefined
    }
  }, [])

  // Scroll to the bottom (debounced). Used outside of streaming and by the public API.
  const scrollToBottom = useCallback(
    (useSmooth = true, forceScroll = false) => {
      const container = containerRef.current
      if (!container || (!isAutoScrollEnabled && !forceScroll) || isScrollingToBottomRef.current) return

      // Do not auto-scroll if the user deliberately left the bottom while streaming
      if (isStreaming && userManuallyLeftBottomDuringStreamingRef.current && !forceScroll) {
        return
      }

      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }

      scrollDebounceRef.current = setTimeout(() => {
        if (!container || (!isAutoScrollEnabled && !forceScroll)) return

        if (isStreaming && userManuallyLeftBottomDuringStreamingRef.current && !forceScroll) {
          return
        }

        isScrollingToBottomRef.current = true

        // Scroll after the DOM update has been flushed
        requestAnimationFrame(() => {
          if (!container) return

          const scrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
          programmaticTopRef.current = scrollTop
          container.scrollTo({
            top: scrollTop,
            behavior: useSmooth ? 'smooth' : 'auto'
          })
        })

        setTimeout(() => {
          isScrollingToBottomRef.current = false
        }, useSmooth ? 300 : 50)
      }, 16)
    },
    [isAutoScrollEnabled, containerRef, isStreaming]
  )

  // Scroll to the top
  const scrollToTop = useCallback(
    (useSmooth = true) => {
      const container = containerRef.current
      if (!container) return

      container.scrollTo({
        top: 0,
        behavior: useSmooth ? 'smooth' : 'auto'
      })
    },
    [containerRef]
  )

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const currentScrollTop = container.scrollTop
    const scrollDirection = currentScrollTop > lastScrollTopRef.current ? 'down' : 'up'
    // Keep the reference position fresh for every scroll, including our own, otherwise the
    // next user scroll is compared against a stale value and its direction is misread.
    lastScrollTopRef.current = currentScrollTop

    const nearBottom = isNearBottom()
    setShowScrollToBottom(!nearBottom)
    setShowScrollToTop(currentScrollTop > threshold)

    // Scrolls this hook performed itself must never be read as user intent. The previous
    // target is accepted too: while content grows, the event for one write can arrive after
    // the next frame has already moved the target.
    const isProgrammatic =
      isScrollingToBottomRef.current ||
      Math.abs(currentScrollTop - programmaticTopRef.current) <= 1 ||
      Math.abs(currentScrollTop - previousProgrammaticTopRef.current) <= 1
    if (isProgrammatic) return

    setIsUserScrolling(true)

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    // The user is considered to have stopped scrolling after 500ms
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false)
    }, 500)

    // A real user scroll always wins over the post-stream pin
    cancelPinLoop()

    const distanceFromBottom = container.scrollHeight - currentScrollTop - container.clientHeight

    if (isStreaming) {
      if (scrollDirection === 'up') {
        // Stop following right away so the follow loop cannot pull the user back down while
        // they are still scrolling. Whether auto-scroll stays off for the rest of the stream
        // is decided by the larger threshold below.
        followSuspendedRef.current = true

        if (distanceFromBottom > threshold * 2) {
          userManuallyLeftBottomDuringStreamingRef.current = true
          setAutoScrollEnabled(false)

          if (scrollDebounceRef.current) {
            clearTimeout(scrollDebounceRef.current)
          }
        }
      } else if (scrollDirection === 'down' && nearBottom) {
        // The user came back to the bottom: resume following
        followSuspendedRef.current = false
        userManuallyLeftBottomDuringStreamingRef.current = false
        setAutoScrollEnabled(true)
      }
    } else {
      if (scrollDirection === 'up') {
        if (distanceFromBottom > threshold) {
          setAutoScrollEnabled(false)
        }
      } else if (scrollDirection === 'down' && nearBottom) {
        setAutoScrollEnabled(true)
      }
    }
  }, [isNearBottom, containerRef, threshold, isStreaming, setAutoScrollEnabled, cancelPinLoop])

  // Listen for scroll events
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll, containerRef])

  // Clear pending timers and frames on unmount only, so a re-registered listener or a
  // re-run effect cannot cancel work that is still needed.
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current)
      if (pinRafRef.current !== undefined) cancelAnimationFrame(pinRafRef.current)
    }
  }, [])

  // Follow the bottom for the whole stream.
  //
  // This used to be a debounced timer driven by the dependency effect, which never settled:
  // every streaming chunk cleared the pending timer, so the scroll fired at most once per
  // stream. A frame loop is immune to chunk frequency, only writes when the position is
  // actually stale, and stops as soon as the user takes over.
  useEffect(() => {
    if (!isStreaming) return

    let frame = requestAnimationFrame(function step() {
      if (shouldFollowBottom()) {
        pinToBottom()
      }
      frame = requestAnimationFrame(step)
    })

    return () => cancelAnimationFrame(frame)
  }, [isStreaming, pinToBottom, shouldFollowBottom])

  // Keep the bottom in view per commit, and across the commit that ends the stream.
  //
  // Every streaming chunk changes `dependencies`, so pinning here follows the stream once per
  // committed chunk, before paint, without depending on animation frames (a background or
  // occluded tab gets no rAF callbacks at all). The rAF loop above stays as well: it covers
  // layout changes that happen without a React commit, such as images or markdown re-layout.
  //
  // When the stream ends, the streaming block is replaced by the persisted message, whose
  // reasoning is collapsed, so the content shrinks by the height of the reasoning block.
  // Pinning before paint (and for a few frames after, because the swap may land in a later
  // commit) keeps the last line of the reply visible instead of showing older content.
  useIsomorphicLayoutEffect(() => {
    const justStoppedStreaming = wasStreamingLayoutRef.current && !isStreaming
    wasStreamingLayoutRef.current = isStreaming

    if (isStreaming) {
      if (shouldFollowBottom()) {
        pinToBottom()
      }
      return
    }

    // Decided once here: the flags are reset by the effect below, but a user who scrolled
    // away during the stream must keep their position.
    if (!justStoppedStreaming || !shouldFollowBottom()) return

    cancelPinLoop()
    pinToBottom()

    let frames = 0
    const step = () => {
      pinToBottom()
      frames += 1
      pinRafRef.current = frames < STREAM_END_PIN_FRAMES ? requestAnimationFrame(step) : undefined
    }
    pinRafRef.current = requestAnimationFrame(step)
    // No cleanup on purpose: this effect re-runs on the very commits (persisted message,
    // collapsed reasoning) that the pin has to survive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, pinToBottom, shouldFollowBottom, cancelPinLoop, ...dependencies])

  // Auto-scroll when the dependencies change outside of streaming
  useEffect(() => {
    const justStoppedStreaming = wasStreamingRef.current && !isStreaming
    const justStartedStreaming = !wasStreamingRef.current && isStreaming

    wasStreamingRef.current = isStreaming

    // The layout effect above already placed the view; only clear the streaming-scoped flags
    if (justStoppedStreaming) {
      userManuallyLeftBottomDuringStreamingRef.current = false
      followSuspendedRef.current = false
      return
    }

    if (justStartedStreaming) {
      userManuallyLeftBottomDuringStreamingRef.current = false
      followSuspendedRef.current = false
    }

    // While streaming the frame loop owns the scroll position
    if (isStreaming) return

    if (isAutoScrollEnabled && !isUserScrolling) {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }

      // Give the DOM time to render before scrolling
      scrollDebounceRef.current = setTimeout(() => {
        scrollToBottom(true)
      }, 50)
    }
  }, [...dependencies, isAutoScrollEnabled, isUserScrolling, isStreaming])

  // Force trigger: jump to the bottom immediately (session switch)
  useEffect(() => {
    if (forceScrollTrigger !== undefined) {
      setAutoScrollEnabled(true)
      setIsUserScrolling(false)
      setShowScrollToTop(false)

      userManuallyLeftBottomDuringStreamingRef.current = false
      followSuspendedRef.current = false
      cancelPinLoop()

      const container = containerRef.current
      if (container) {
        const target = Math.max(0, container.scrollHeight - container.clientHeight)
        programmaticTopRef.current = target
        lastScrollTopRef.current = target
        container.scrollTop = target
      }
    }
  }, [forceScrollTrigger, containerRef, setAutoScrollEnabled, cancelPinLoop])

  // Smooth trigger: user sent a message
  useEffect(() => {
    if (scrollToBottomTrigger !== undefined && scrollToBottomTrigger > 0) {
      setAutoScrollEnabled(true)
      setIsUserScrolling(false)
      setShowScrollToBottom(false)
      setShowScrollToTop(false)

      userManuallyLeftBottomDuringStreamingRef.current = false
      followSuspendedRef.current = false
      cancelPinLoop()

      const container = containerRef.current
      if (container) {
        const target = Math.max(0, container.scrollHeight - container.clientHeight)
        programmaticTopRef.current = target
        container.scrollTo({
          top: target,
          behavior: 'smooth'
        })
      }
    }
  }, [scrollToBottomTrigger, containerRef, setAutoScrollEnabled, cancelPinLoop])

  // Start at the bottom
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      const target = Math.max(0, container.scrollHeight - container.clientHeight)
      programmaticTopRef.current = target
      lastScrollTopRef.current = target
      container.scrollTop = target
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
      setAutoScrollEnabled(true)
      setShowScrollToBottom(false)
      userManuallyLeftBottomDuringStreamingRef.current = false
      followSuspendedRef.current = false
      scrollToBottom(true)
    },
    scrollToTop: () => {
      setShowScrollToTop(false)
      scrollToTop(true)
    },
    forceScrollToBottom: () => {
      const container = containerRef.current
      if (container) {
        setAutoScrollEnabled(true)
        setShowScrollToBottom(false)
        userManuallyLeftBottomDuringStreamingRef.current = false
        followSuspendedRef.current = false
        isScrollingToBottomRef.current = true
        const target = Math.max(0, container.scrollHeight - container.clientHeight)
        programmaticTopRef.current = target
        container.scrollTo({
          top: target,
          behavior: 'smooth'
        })
        setTimeout(() => {
          isScrollingToBottomRef.current = false
        }, 300)
      }
    }
  }
}
