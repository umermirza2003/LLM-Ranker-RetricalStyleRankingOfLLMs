import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./contexts/AuthContext"
import ProtectedRoute from "./components/auth/ProtectedRoute"
import DashboardLayout from "./components/layout/DashboardLayout"

// Auth Pages
import LoginPage from "./pages/auth/LoginPage"
import RegisterPage from "./pages/auth/RegisterPage"

// Main Pages
import DashboardPage from "./pages/DashboardPage"
import ProfilePage from "./pages/ProfilePage"
import ModelStatisticsPage from "./pages/ModelStatisticsPage"
import HomePage from "./pages/HomePage"
import AnswerPage from "./pages/AnswerPage"
import LandingPage from "./pages/LandingPage"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Dashboard pages: explicit layout + page (avoids empty Outlet with pathless nested routes) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ProfilePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/model-statistics"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ModelStatisticsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Legacy Routes (for existing functionality) */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="/answer/:model" element={<AnswerPage />} />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

