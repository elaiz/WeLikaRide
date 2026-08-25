import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function RideHistory({ profile }) {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    async function load() {
      const field = profile.role === 'driver' ? 'driver_id' : 'rider_id'
      const { data } = await supabase
        .from('ride_requests')
        .select('*')
        .eq(field, profile.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setRides(data || [])
      setLoading(false)
    }
    load()
  }, [profile])

  const totalMiles = profile?.role === 'driver'
    ? rides.reduce((sum, r) => sum + (parseFloat(r.mileage) || 0), 0)
    : null

  if (loading) return <p className="text-gray-400 py-8 text-center">Loading…</p>

  return (
    <div className="py-4 flex flex-col gap-4">
      <h2 className="text-xl font-bold text-gray-800">Ride History</h2>

      {profile?.role === 'driver' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-3xl">🛣️</span>
          <div>
            <p className="text-sm text-gray-600">Total miles driven</p>
            <p className="text-2xl font-bold text-indigo-700">{totalMiles.toFixed(1)} mi</p>
          </div>
        </div>
      )}

      {rides.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No ride history yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rides.map(ride => (
            <div key={ride.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  ride.status === 'completed' ? 'bg-green-50 text-green-600' :
                  ride.status === 'accepted' ? 'bg-blue-50 text-blue-600' :
                  ride.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                  'bg-gray-50 text-gray-500'
                }`}>{ride.status}</span>
                <span className="text-xs text-gray-400">{new Date(ride.created_at).toLocaleDateString()}</span>
              </div>
              {profile.role === 'driver' && (
                <p className="text-sm font-medium text-gray-700">🙋 {ride.rider_name}</p>
              )}
              {profile.role === 'rider' && ride.driver_name && (
                <p className="text-sm font-medium text-gray-700">🚗 {ride.driver_name}</p>
              )}
              <p className="text-sm text-gray-600">📍 {ride.pickup_address || 'GPS location'}</p>
              {ride.pickup_time && (
                <p className="text-xs text-gray-400">🕐 {new Date(ride.pickup_time).toLocaleString()}</p>
              )}
              {profile.role === 'driver' && ride.mileage && (
                <p className="text-xs text-indigo-600">🛣️ {parseFloat(ride.mileage).toFixed(1)} miles</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
