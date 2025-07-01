import { useState, useEffect } from 'react'

const STORAGE_KEY = 'agent-playground-draft-message'

export function useDraftMessage() {
  const [message, setMessage] = useState('')

  // Load draft message from localStorage on hook initialization
  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY)
    if (savedDraft) {
      setMessage(savedDraft)
    }
  }, [])

  // Save draft message to localStorage whenever message changes
  useEffect(() => {
    if (message.trim()) {
      localStorage.setItem(STORAGE_KEY, message)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [message])

  // Function to clear the draft
  const clearDraft = () => {
    setMessage('')
    localStorage.removeItem(STORAGE_KEY)
  }

  // Function to update the message
  const updateMessage = (newMessage: string) => {
    setMessage(newMessage)
  }

  return {
    message,
    setMessage: updateMessage,
    clearDraft
  }
}
