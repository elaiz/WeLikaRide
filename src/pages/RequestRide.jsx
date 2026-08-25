import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function RequestRide({ profile }) {
  const navigate = useNavigate()
  const [address, setAddress] = useState('')
  const [useGPS, setUseGPS] = useState(false)
  const [coords, setCoords] = useState(null)
  const [gpsError, setGpsError] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function getLocation() {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setUseGPS(true)
        setGpsError('')
      },
      () => setGpsError('Could not get your location. Please enter an address.')
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!useGPS && !address.trim()) {
      setError('Please enter a pickup address or use your location.')
      return
    }
    setError('')
    setLoading(true)

    const payload = {
      rider_id: profile.id,
      rider_name: profile.name,
      special_requests: profile.special_requests || null,
      pickup_address: useGPS ? null : address.trim(),
      pickup_lat: coords?.lat ?? null,
      pickup_lng: coords?.lng ?? null,
      pickup_time: pickupTime || null,
      notes: notes.trim() || null,
      status: 'pending',
    }

    const { error: dbErr } = await supabase.from('ride_requests').insert(payload)
    setLoading(false)
    if (dbErr) {
      setError(dbErr.message)
    } else {
      navigate('/rider')
    }
  }

  return (
    <div className="py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Request a Ride</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700">Pickup Location</p>
          <button
            type="button"
            onClick={getLocation}
            className="flex items-center gap-2 border border-indigo-300 text-indigo-600 rounded-lg px-3 py-2 text-sm hover:bg-indigo-50"
          >
            📍 Use my current location
          </button>
          {useGPS && coords && (
            <p className="text-xs text-green-600">✓ Location captured ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})</p>
          )}
          {gpsError && <p className="text-xs text-red-500">{gpsError}</p>}
          <p className="text-xs text-gray-400 text-center">— or enter an address —</p>
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="123 Church St, City, State"
            value={address}
            onChange={e => { setAddress(e.target.value); if (e.target.value) setUseGPS(false) }}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700">Pickup Time (optional)</p>
          <input
            type="datetime-local"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={pickupTime}
            onChange={e => setPickupTime(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700">Notes (optional)</p>
          <textarea
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Any special instructions…"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white rounded-xl py-3 font-medium text-base hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Sending request…' : 'Request Ride'}
        </button>
      </form>
    </div>
  )
}
