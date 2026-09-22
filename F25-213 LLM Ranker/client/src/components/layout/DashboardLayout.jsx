import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { 
  LayoutDashboard, 
  User, 
  LogOut,
  Menu,
  X,
  Home,
  BarChart3,
} from "lucide-react"
import { Button } from "../ui/button"
import Avatar from "../ui/Avatar"
import { cn } from "@/lib/utils"

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate("/", { replace: true })
  }

  const menuItems = [
    { path: "/home", icon: Home, label: "Home" },
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/model-statistics", icon: BarChart3, label: "Model statistics" },
    { path: "/profile", icon: User, label: "Profile" },
  ]

  return (
    <div className="dashboard-layout-container flex min-h-screen flex-col">
      {/* Mobile Header */}
      <div className="mobile-header-container shrink-0">
        <h1 className="header-title">LLM RANKER</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="icon-button"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 w-full">
        {/* Sidebar */}
        <aside
          className={cn(
            "sidebar-container-base",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* User Info */}
          <Link
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className="sidebar-user-section"
          >
            <div className="user-info-row">
              <div className="user-avatar-container">
                <Avatar src={user?.avatar} alt={user?.name || "User"} size="md" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="user-name-text">{user?.name || "User"}</p>
                <p className="user-email-text">{user?.email}</p>
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="navigation-container">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "navigation-item-base",
                    isActive 
                      ? "navigation-item-active" 
                      : "navigation-item-inactive"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isActive ? "" : "dark:text-gray-300")} />
                  <span className={cn("font-medium", isActive ? "" : "dark:text-gray-300")}>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="button-full-width justify-start dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="overlay-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:ml-0">
          {children}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout

