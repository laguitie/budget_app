import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth, RequireHousehold } from './components/Guards'
import { Layout } from './components/Layout'
import { HouseholdProvider } from './household/HouseholdProvider'
import { AcceptInvitationPage } from './pages/AcceptInvitationPage'
import { CreateHouseholdPage } from './pages/CreateHouseholdPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { RegisterPage } from './pages/RegisterPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/ingresar" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/invitacion/:token" element={<AcceptInvitationPage />} />
      <Route
        path="/crear-hogar"
        element={
          <RequireAuth>
            <CreateHouseholdPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <RequireHousehold>
              <Layout />
            </RequireHousehold>
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="/miembros" element={<MembersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HouseholdProvider>
          <AppRoutes />
        </HouseholdProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
