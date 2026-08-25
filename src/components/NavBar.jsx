import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function NavBar({ profile }) {
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow">
      <span className="font-bold text-lg tracking-tight">🚗 WeLikaRide</span>
      <div className="flex gap-4 text-sm items-center">
        {profile?.role === 'rider' && (
          <>
            <Link to="/rider" className="hover:underline">Home</Link>
            <Link to="/rider/request" className="hover:underline">Request</Link>
          </>
        )}
        {profile?.role === 'driver' && (
          <Link to="/driver" className="hover:underline">Rides</Link>
        )}
        <Link to="/history" className="hover:underline">History</Link>
        <button onClick={signOut} className="bg-indigo-800 rounded px-2 py-1 hover:bg-indigo-900">
          Sign Out
        </button>
      </div>
    </nav>
  )
}
