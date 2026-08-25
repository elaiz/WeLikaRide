import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const STATUS_LABEL = {
  pending: { label: 'Waiting for driver', color: 'text-yellow-600 bg-yellow-50' },
  accepted: { label: 'Driver on the way', color: 'text-blue-600 bg-blue-50' },
  completed: { label: 'Completed', color: 'text-green-600 bg-green-50' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500 bg-gray-50' },
}

export default function RiderDashboard({ profile }) {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadRides()
    const channel = supabase
      .channel('rider-rides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests', filter: `rider_id=eq.${profile.id}` }, loadRides)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  async function loadRides() {
    const { data } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('rider_id', profile.id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
    setRides(data || [])
    setLoading(false)
  }

  if (loading) return <p className="text-gray-400 py-8 text-center">Loading…</p>

  return (
    <div className="py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Hi, {profile?.name?.split(' ')[0]}! 👋</h2>
        <Link
          to="/rider/request"
          className="bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          + Request Ride
        </Link>
      </div>

      {rides.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-4xl mb-3">🙏</p>
          <p className="text-gray-500 text-sm">No active ride requests.</p>
          <p className="text-gray-400 text-xs mt-1">Tap "Request Ride" to get started.</p>
        </div>
      ) : (
        rides.map(ride => {
          const s = STATUS_LABEL[ride.status] || STATUS_LABEL.pending
          return (
            <div key={ride.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.color}`}>{s.label}</span>
                <span className="text-xs text-gray-400">{new Date(ride.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-700">
                📍 {ride.pickup_address || (ride.pickup_lat ? `${parseFloat(ride.pickup_lat).toFixed(4)}, ${parseFloat(ride.pickup_lng).toFixed(4)}` : 'Location set')}
              </p>
              {ride.pickup_time && (
                <p className="text-xs text-gray-500">🕐 {new Date(ride.pickup_time).toLocaleString()}</p>
              )}
              {ride.driver_name && (
                <p className="text-sm text-indigo-600 font-medium">🚗 {ride.driver_name} is your driver</p>
              )}
              {ride.notes && <p className="text-xs text-gray-400 italic">"{ride.notes}"</p>}
            </div>
          )
        })
      )}
    </div>
  )
}
