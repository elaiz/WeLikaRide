import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // If a driver invite token is in the URL, this registration is for a driver
  const params = new URLSearchParams(window.location.search)
  const inviteToken = params.get('invite') || ''
  const isDriverInvite = inviteToken.length > 0

  // Validate token exists and isn't expired before showing the driver form
  const [tokenValid, setTokenValid] = useState(null) // null=checking, true, false

  useEffect(() => {
    if (!isDriverInvite) { setTokenValid(true); return }
    async function checkToken() {
      const { data } = await supabase
        .from('driver_invites')
        .select('id, expires_at, used_by')
        .eq('token', inviteToken)
        .single()
      setTokenValid(
        !!data && !data.used_by && new Date(data.expires_at) > new Date()
      )
    }
    checkToken()
  }, [inviteToken, isDriverInvite])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      // All self-registrations are riders unless a valid invite token is present
      const role = isDriverInvite && tokenValid ? 'driver' : 'rider'

      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user) {
        // Create profile — drivers start unapproved until invite RPC approves them
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name,
          phone,
          role,
          approved: role !== 'driver', // riders/admins approved by default; drivers need invite consumed
        })

        if (role === 'driver') {
          const ok = await supabase.rpc('consume_driver_invite', {
            p_token: inviteToken,
            p_user_id: data.user.id,
          })
          if (!ok.data) {
            setError('Invite token is invalid or has already been used. Please contact an admin.')
            setLoading(false)
            return
          }
        }

        setMessage('Account created! Check your email to confirm, then sign in.')
      }
    }
    setLoading(false)
  }

  // Token is still being verified
  if (isDriverInvite && tokenValid === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500">Verifying invite…</p>
      </div>
    )
  }

  // Token is invalid or expired
  if (isDriverInvite && tokenValid === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
          <p className="text-4xl mb-3">🚫</p>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Invite Link Invalid</h2>
          <p className="text-sm text-gray-500">This driver invite link has expired or already been used. Please ask a church admin for a new one.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-indigo-600 text-center mb-1">🚗 WeLikaRide</h1>
        <p className="text-center text-gray-500 text-sm mb-1">Church Ride Coordination</p>
        {isDriverInvite && (
          <p className="text-center text-green-600 text-xs font-medium mb-4">
            ✅ Driver invite detected — register as a volunteer driver
          </p>
        )}

        <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-6">
          <button
            className={`flex-1 py-2 text-sm font-medium ${mode === 'login' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setMode('login')}
          >Sign In</button>
          <button
            className={`flex-1 py-2 text-sm font-medium ${mode === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setMode('register')}
          >Register</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <>
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Phone number"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
              {/* Role is determined by the invite token — no manual selection */}
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isDriverInvite ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
                {isDriverInvite ? '🚗 Registering as a Volunteer Driver' : '🙋 Registering as a Rider'}
              </div>
            </>
          )}
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
