import { useState, useEffect } from "react"
import ChatItem from "./ChatItem"

const ChatList = ({ onChatSelect }) => {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)

  // Load chats from localStorage on mount
  useEffect(() => {
    const savedChats = localStorage.getItem("llm-ranker-chats")
    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats)
        setChats(parsedChats)
      } catch (error) {
        console.error("Error loading chats from localStorage:", error)
      }
    } else {
      // Initialize with default chats if none exist
      const defaultChats = [
        { 
          id: 1, 
          name: "Chat 1", 
          createdAt: new Date().toISOString(),
          messages: [
            { role: "user", content: "What is machine learning?" },
            { role: "assistant", content: "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed." }
          ]
        },
        { 
          id: 2, 
          name: "Chat 2", 
          createdAt: new Date().toISOString(),
          messages: [
            { role: "user", content: "Explain neural networks" },
            { role: "assistant", content: "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information through weighted connections." }
          ]
        },
        { 
          id: 3, 
          name: "Chat 3", 
          createdAt: new Date().toISOString(),
          messages: [
            { role: "user", content: "How does GPT work?" },
            { role: "assistant", content: "GPT (Generative Pre-trained Transformer) uses transformer architecture with attention mechanisms to generate human-like text by predicting the next word in a sequence." }
          ]
        },
        { 
          id: 4, 
          name: "Chat 4", 
          createdAt: new Date().toISOString(),
          messages: [
            { role: "user", content: "What is deep learning?" },
            { role: "assistant", content: "Deep learning is a subset of machine learning that uses neural networks with multiple layers to learn complex patterns in data." }
          ]
        },
        { 
          id: 5, 
          name: "Chat 5", 
          createdAt: new Date().toISOString(),
          messages: [
            { role: "user", content: "Explain natural language processing" },
            { role: "assistant", content: "Natural Language Processing (NLP) is a field of AI that focuses on enabling computers to understand, interpret, and generate human language in a valuable way." }
          ]
        },
      ]
      setChats(defaultChats)
      localStorage.setItem("llm-ranker-chats", JSON.stringify(defaultChats))
    }
  }, [])

  // Save chats to localStorage whenever chats change
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem("llm-ranker-chats", JSON.stringify(chats))
    }
  }, [chats])

  const handleChatClick = (chatId) => {
    setActiveChatId(chatId)
    const selectedChat = chats.find(chat => chat.id === chatId)
    if (selectedChat && onChatSelect) {
      onChatSelect(selectedChat)
    }
  }

  return (
    <div>
      <h2 className="section-title text-sm mb-4 tracking-tight">
        Chats
      </h2>
      <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
        {chats.map((chat) => (
          <ChatItem
            key={chat.id}
            chat={chat}
            isActive={activeChatId === chat.id}
            onClick={() => handleChatClick(chat.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default ChatList

