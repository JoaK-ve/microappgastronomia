import { AppRouter } from '@/app/router'
import { AuthProvider } from '@/features/auth/AuthContext'

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}

export default App
