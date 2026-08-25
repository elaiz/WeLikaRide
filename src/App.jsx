import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './pages/AuthPage'
import RiderDashboard from './pages/RiderDashboard'
import DriverDashboard from './pages/DriverDashboard'
import RequestRide from './pages/RequestRide'
import RideHistory from './pages/RideHistory'
import NavBar from './components/NavBar'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Loading…</p>
    </div>
  )

  if (!session) return <AuthPage onAuth={() => {}} />

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavBar profile={profile} />
        <main className="flex-1 p-4 max-w-lg mx-auto w-full">
          <Routes>
            <Route path="/" element={
              profile?.role === 'driver'
                ? <Navigate to="/driver" replace />
                : <Navigate to="/rider" replace />
            } />
            <Route path="/rider" element={<RiderDashboard profile={profile} />} />
            <Route path="/rider/request" element={<RequestRide profile={profile} />} />
            <Route path="/driver" element={<DriverDashboard profile={profile} />} />
            <Route path="/history" element={<RideHistory profile={profile} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
