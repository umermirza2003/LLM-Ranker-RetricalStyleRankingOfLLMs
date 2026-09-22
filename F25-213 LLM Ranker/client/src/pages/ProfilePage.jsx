import { useState, useEffect, useRef } from "react"
import { useAuth } from "../contexts/AuthContext"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Label } from "../components/ui/label"
import { Moon, Sun, Upload, X } from "lucide-react"

const ProfilePage = () => {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [avatar, setAvatar] = useState(user?.avatar || null)
  const [theme, setTheme] = useState(localStorage.getItem("llm-ranker-theme") || "light")
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (user) {
      setName(user.name || "")
      setEmail(user.email || "")
      setAvatar(user.avatar || null)
    }
  }, [user])

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    localStorage.setItem("llm-ranker-theme", theme)
  }, [theme])

  // Load theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("llm-ranker-theme") || "light"
    setTheme(savedTheme)
    const root = document.documentElement
    if (savedTheme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB')
        return
      }
      
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result
        setAvatar(base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatar(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = () => {
    updateUser({ name, email, avatar })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return (
    <div className="page-padding-centered">
      <div>
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="dark:text-gray-100">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar Upload */}
          <div className="form-field-group">
            <Label>Profile Picture</Label>
            <div className="avatar-upload-container">
              <div className="avatar-preview-container">
                {avatar ? (
                  <img 
                    src={avatar} 
                    alt="Profile" 
                    className="avatar-preview-image"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-gray-400">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                )}
                {avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="avatar-remove-button"
                    aria-label="Remove avatar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="avatar-upload-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="avatar-file-input"
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload" className="avatar-upload-label">
                  <Upload className="w-4 h-4 mr-2" />
                  {avatar ? 'Change Photo' : 'Upload Photo'}
                </label>
              </div>
            </div>
          </div>

          <div className="form-field-group">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-field-group">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled
              className="bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
            />
            <p className="body-text-muted">Email cannot be changed</p>
          </div>

          <Button onClick={handleSave} className="button-full-width dark:bg-gray-700 dark:hover:bg-gray-600">
            Save Changes
          </Button>

          {saved && (
            <div className="form-success-message">
              <p className="form-success-text">✓ Profile updated successfully!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="dark:text-gray-100">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="preference-row">
            <div>
              <Label>Theme</Label>
              <p className="preference-label-container">Switch between light and dark mode</p>
            </div>
            <Button
              variant="outline"
              onClick={toggleTheme}
              className="button-icon-text dark:hover:bg-gray-700"
            >
              {theme === "light" ? (
                <>
                  <Sun className="w-4 h-4" />
                  Light
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  Dark
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfilePage

