import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const STATUS_LABEL = {
  pending:   { label: 'Waiting for driver', color: 'text-yellow-600 bg-yellow-50' },
  accepted:  { label: 'Driver on the way',  color: 'text-blue-600 bg-blue-50'   },
  completed: { label: 'Completed',          color: 'text-green-600 bg-green-50' },
  cancelled: { label: 'Cancelled',          color: 'text-gray-500 bg-gray-50'   },
}

export default function RiderDashboard({ profile, onProfileUpdate }) {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)

  // Special-requests inline editor
  const [editingAccom, setEditingAccom] = useState(false)
  const [accomDraft, setAccomDraft] = useState(profile?.special_requests || '')
  const [savingAccom, setSavingAccom] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAccomDraft(profile?.special_requests || '')
  }, [profile?.special_requests])

  useEffect(() => {
    if (!profile) return
    loadRides()
    const channel = supabase
      .channel('rider-rides')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ride_requests',
        filter: `rider_id=eq.${profile.id}`,
      }, loadRides)
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

  async function saveAccom() {
    setSavingAccom(true)
    const { error: saveErr } = await supabase
      .from('profiles')
      .update({ special_requests: accomDraft.trim() || null })
      .eq('id', profile.id)
    setSavingAccom(false)
    if (saveErr) {
      setError('Could not save accommodations. Please try again.')
      return
    }
    setEditingAccom(false)
    setError('')
    if (onProfileUpdate) onProfileUpdate()
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

      {/* Special accommodations card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800">♿ Special Accommodations</p>
          {!editingAccom && (
            <button
              onClick={() => setEditingAccom(true)}
              className="text-xs text-amber-700 underline hover:text-amber-900"
            >
              Edit
            </button>
          )}
        </div>
        {editingAccom ? (
          <>
            <textarea
              className="border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              placeholder="e.g. wheelchair accessible vehicle needed, assistance getting in/out, service animal, hearing impaired…"
              rows={3}
              value={accomDraft}
              onChange={e => setAccomDraft(e.target.value)}
            />
            <p className="text-xs text-amber-700">This is saved to your profile and shown to every driver who accepts your ride.</p>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={saveAccom}
                disabled={savingAccom}
                className="bg-amber-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {savingAccom ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingAccom(false); setAccomDraft(profile?.special_requests || '') }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-amber-900">
            {profile?.special_requests || <span className="text-amber-400 italic">None set — tap Edit to add any needs.</span>}
          </p>
        )}
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
