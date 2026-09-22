import { createContext, useContext, useState, useEffect } from "react"

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem("llm-ranker-user")
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error("Error loading user:", error)
        localStorage.removeItem("llm-ranker-user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = (email, password) => {
    // Dummy login - in real app, this would call an API
    const dummyUser = {
      id: 1,
      email,
      name: email.split("@")[0],
      avatar: null,
    }
    setUser(dummyUser)
    localStorage.setItem("llm-ranker-user", JSON.stringify(dummyUser))
    return { success: true }
  }

  const register = (email, password, name) => {
    // Dummy registration
    const dummyUser = {
      id: Date.now(),
      email,
      name: name || email.split("@")[0],
      avatar: null,
    }
    setUser(dummyUser)
    localStorage.setItem("llm-ranker-user", JSON.stringify(dummyUser))
    return { success: true }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("llm-ranker-user")
    localStorage.removeItem("llm-ranker-selected-models")
    localStorage.removeItem("llm-ranker-chats")
  }

  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)
    localStorage.setItem("llm-ranker-user", JSON.stringify(updatedUser))
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}

