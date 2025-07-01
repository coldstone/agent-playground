// 全局滚动位置管理器
class ScrollManager {
  private scrollPositions = new Map<string, number>()
  private observers = new Map<string, MutationObserver>()

  // 保存滚动位置
  saveScrollPosition(id: string, position: number) {
    this.scrollPositions.set(id, position)
  }

  // 获取滚动位置
  getScrollPosition(id: string): number {
    return this.scrollPositions.get(id) || 0
  }

  // 恢复滚动位置
  restoreScrollPosition(element: HTMLElement, id: string) {
    const position = this.getScrollPosition(id)
    if (position > 0) {
      // 使用多重 requestAnimationFrame 确保 DOM 完全渲染
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (element) {
            element.scrollLeft = position
          }
        })
      })
    }
  }

  // 监听元素变化并自动恢复滚动位置
  observeElement(element: HTMLElement, id: string) {
    // 清理之前的观察器
    this.unobserveElement(id)

    // 创建新的观察器
    const observer = new MutationObserver(() => {
      this.restoreScrollPosition(element, id)
    })

    // 观察子树变化
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })

    this.observers.set(id, observer)
  }

  // 停止观察元素
  unobserveElement(id: string) {
    const observer = this.observers.get(id)
    if (observer) {
      observer.disconnect()
      this.observers.delete(id)
    }
  }

  // 清理所有数据
  cleanup() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
    this.scrollPositions.clear()
  }
}

// 创建全局实例
export const scrollManager = new ScrollManager()

// 在页面卸载时清理
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    scrollManager.cleanup()
  })
}
