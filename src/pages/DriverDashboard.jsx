import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function DriverDashboard({ profile }) {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [mileageInput, setMileageInput] = useState({})
  const [savingMileage, setSavingMileage] = useState({})

  useEffect(() => {
    if (!profile) return
    loadRides()
    const channel = supabase
      .channel('driver-rides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, loadRides)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  async function loadRides() {
    const { data } = await supabase
      .from('ride_requests')
      .select('*')
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
    setRides(data || [])
    setLoading(false)
  }

  async function acceptRide(rideId) {
    await supabase.from('ride_requests').update({
      status: 'accepted',
      driver_id: profile.id,
      driver_name: profile.name,
    }).eq('id', rideId)
  }

  async function completeRide(ride) {
    const miles = parseFloat(mileageInput[ride.id] || 0)
    setSavingMileage(s => ({ ...s, [ride.id]: true }))
    await supabase.rpc('complete_ride', { ride_id: ride.id, miles: miles || 0 })
    setSavingMileage(s => ({ ...s, [ride.id]: false }))
  }

  function openDirections(ride) {
    const dest = 'WeLika Church'
    if (ride.pickup_lat && ride.pickup_lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${ride.pickup_lat},${ride.pickup_lng}&destination=${encodeURIComponent(dest)}&travelmode=driving`, '_blank')
    } else if (ride.pickup_address) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ride.pickup_address)}&destination=${encodeURIComponent(dest)}&travelmode=driving`, '_blank')
    }
  }

  if (loading) return <p className="text-gray-400 py-8 text-center">Loading…</p>

  const myRides = rides.filter(r => r.driver_id === profile.id && r.status === 'accepted')
  const pendingRides = rides.filter(r => r.status === 'pending')

  return (
    <div className="py-4 flex flex-col gap-6">
      <h2 className="text-xl font-bold text-gray-800">Driver Dashboard 🚗</h2>

      {myRides.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">My Active Rides</h3>
          <div className="flex flex-col gap-3">
            {myRides.map(ride => (
              <div key={ride.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-3">
                <div>
                  <p className="font-medium text-gray-800">{ride.rider_name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    📍 {ride.pickup_address || (ride.pickup_lat ? `${parseFloat(ride.pickup_lat).toFixed(4)}, ${parseFloat(ride.pickup_lng).toFixed(4)}` : 'Location set')}
                  </p>
                  {ride.pickup_time && (
                    <p className="text-xs text-gray-500 mt-1">🕐 {new Date(ride.pickup_time).toLocaleString()}</p>
                  )}
                  {ride.notes && <p className="text-xs text-gray-400 italic mt-1">"{ride.notes}"</p>}
                </div>
                <button
                  onClick={() => openDirections(ride)}
                  className="bg-white border border-blue-300 text-blue-600 rounded-lg px-3 py-2 text-sm hover:bg-blue-50"
                >
                  🗺️ Open Directions
                </button>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Miles driven"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-green-400"
                    value={mileageInput[ride.id] || ''}
                    onChange={e => setMileageInput(m => ({ ...m, [ride.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => completeRide(ride)}
                    disabled={savingMileage[ride.id]}
                    className="bg-green-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    ✓ Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Pending Requests ({pendingRides.length})
        </h3>
        {pendingRides.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500 text-sm">No pending ride requests right now.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingRides.map(ride => (
              <div key={ride.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                <div>
                  <p className="font-medium text-gray-800">{ride.rider_name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    📍 {ride.pickup_address || (ride.pickup_lat ? `${parseFloat(ride.pickup_lat).toFixed(4)}, ${parseFloat(ride.pickup_lng).toFixed(4)}` : 'Location set')}
                  </p>
                  {ride.pickup_time && (
                    <p className="text-xs text-gray-500 mt-1">🕐 {new Date(ride.pickup_time).toLocaleString()}</p>
                  )}
                  {ride.notes && <p className="text-xs text-gray-400 italic mt-1">"{ride.notes}"</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(ride.created_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => acceptRide(ride.id)}
                  className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-700"
                >
                  Accept This Ride
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
