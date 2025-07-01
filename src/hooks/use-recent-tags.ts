import { useState, useEffect } from 'react'

const RECENT_TAGS_KEY = 'agent-playground-recent-tags'
const MAX_RECENT_TAGS = 10

export function useRecentTags() {
  const [recentTags, setRecentTags] = useState<string[]>([])

  // 从localStorage加载最近使用的标签
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_TAGS_KEY)
      if (stored) {
        const tags = JSON.parse(stored)
        if (Array.isArray(tags)) {
          setRecentTags(tags)
        }
      }
    } catch (error) {
      console.error('Failed to load recent tags:', error)
    }
  }, [])

  // 保存标签到localStorage
  const saveToStorage = (tags: string[]) => {
    try {
      localStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(tags))
    } catch (error) {
      console.error('Failed to save recent tags:', error)
    }
  }

  // 添加标签到最近使用列表
  const addRecentTag = (tag: string) => {
    if (!tag || !tag.trim()) return

    const trimmedTag = tag.trim()
    
    setRecentTags(prevTags => {
      // 移除已存在的相同标签
      const filteredTags = prevTags.filter(t => t !== trimmedTag)
      
      // 将新标签添加到开头
      const newTags = [trimmedTag, ...filteredTags].slice(0, MAX_RECENT_TAGS)
      
      // 保存到localStorage
      saveToStorage(newTags)
      
      return newTags
    })
  }

  // 删除标签
  const removeRecentTag = (tag: string) => {
    setRecentTags(prevTags => {
      const newTags = prevTags.filter(t => t !== tag)
      saveToStorage(newTags)
      return newTags
    })
  }

  // 清空所有最近标签
  const clearRecentTags = () => {
    setRecentTags([])
    saveToStorage([])
  }

  return {
    recentTags,
    addRecentTag,
    removeRecentTag,
    clearRecentTags
  }
}
