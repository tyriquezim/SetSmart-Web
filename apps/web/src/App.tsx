import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './auth/context'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { isSupabaseConfigured } from './lib/supabase'
import { AddFoodPage } from './pages/AddFoodPage'
import { AuthPage } from './pages/AuthPage'
import { ExerciseProgressPage } from './pages/ExerciseProgressPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { FoodPage } from './pages/FoodPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { ProgressPage } from './pages/ProgressPage'
import { RoutineDetailPage } from './pages/RoutineDetailPage'
import { RoutineEditorPage } from './pages/RoutineEditorPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RoutinesPage } from './pages/RoutinesPage'
import { SessionPage } from './pages/SessionPage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { ActiveWorkoutProvider } from './workout/ActiveWorkoutProvider'

function AuthedShell() {
  return (
    <ActiveWorkoutProvider>
      <Outlet />
    </ActiveWorkoutProvider>
  )
}

/** Someone who opened a password reset link must choose a new password before anything else. */
function RecoveryRedirect() {
  const { recovering, user } = useAuth()
  const { pathname } = useLocation()
  if (recovering && user && pathname !== '/reset-password') return <Navigate to="/reset-password" replace />
  return null
}

export function App() {
  if (!isSupabaseConfigured) return <SetupPage />
  return (
    <BrowserRouter>
      <RecoveryRedirect />
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AuthedShell />}>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="routines" element={<RoutinesPage />} />
              <Route path="routines/new" element={<RoutineEditorPage />} />
              <Route path="routines/:id" element={<RoutineDetailPage />} />
              <Route path="routines/:id/edit" element={<RoutineEditorPage />} />
              <Route path="exercises" element={<ExercisesPage />} />
              <Route path="food" element={<FoodPage />} />
              <Route path="food/add" element={<AddFoodPage />} />
              <Route path="progress" element={<ProgressPage />} />
              <Route path="progress/exercises/:id" element={<ExerciseProgressPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="history/:id" element={<SessionPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="workout" element={<WorkoutPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
